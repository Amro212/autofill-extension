import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { PairingService } from "../src/auth/pairing.js";
import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { ApplicationRepository } from "../src/repositories/applications.js";
import { JobRepository } from "../src/repositories/jobs.js";
import { SettingsRepository } from "../src/repositories/settings.js";

const cleanups: Array<() => Promise<void> | void> = [];

function openStores(filename?: string) {
  const directory = filename === undefined
    ? mkdtempSync(join(tmpdir(), "job-copilot-sessions-"))
    : undefined;
  const databaseFile = filename ?? join(directory!, "sessions.sqlite");
  const connection = openDatabase(databaseFile);
  migrateDatabase(connection);
  const settings = new SettingsRepository(connection.db);
  return {
    connection,
    databaseFile,
    directory,
    jobs: new JobRepository(connection.db),
    applications: new ApplicationRepository(connection.db, settings),
  };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("job and application persistence", () => {
  it("recovers a captured job and tab-linked session after database restart", () => {
    const first = openStores();
    const job = first.jobs.create({
      title: "Engineer",
      company: "Example Corp",
      listingUrl: "https://example.test/jobs/1",
    });
    const session = first.applications.create({
      jobId: job.id,
      originatingTabId: 10,
      activeTabIds: [10, 20],
    });
    first.connection.close();

    const restarted = openStores(first.databaseFile);
    expect(restarted.jobs.get(job.id)?.title).toBe("Engineer");
    expect(restarted.applications.findByTab(20)).toMatchObject({
      id: session.id,
      jobId: job.id,
      state: "DISCOVERED",
    });
    restarted.connection.close();
    rmSync(first.directory!, { recursive: true, force: true });
  });

  it("persists only legal state transitions", () => {
    const stores = openStores();
    const session = stores.applications.create({ activeTabIds: [1] });

    expect(
      stores.applications.transition(session.id, "APPLICATION_LINKED"),
    ).toMatchObject({ state: "APPLICATION_LINKED" });
    expect(() =>
      stores.applications.transition(session.id, "SUBMITTED"),
    ).toThrow("Illegal application transition");
    stores.connection.close();
    rmSync(stores.directory!, { recursive: true, force: true });
  });
});

describe("job and application API", () => {
  it("validates capture payloads and recovers a session by tab", async () => {
    const stores = openStores();
    const pairingService = new PairingService({
      installationId: "installation-1",
      pairingSecret: "setup-secret",
    });
    const app = buildApp({
      logger: false,
      pairingService,
      jobRepository: stores.jobs,
      applicationRepository: stores.applications,
    });
    cleanups.push(async () => {
      await app.close();
      stores.connection.close();
      rmSync(stores.directory!, { recursive: true, force: true });
    });
    const authorization = `Bearer ${pairingService.pair("setup-secret").token}`;

    const invalid = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { authorization },
      payload: {},
    });
    expect(invalid.statusCode).toBe(400);

    const captured = await app.inject({
      method: "POST",
      url: "/v1/jobs",
      headers: { authorization },
      payload: { title: "Engineer", company: "Example Corp" },
    });
    expect(captured.statusCode).toBe(201);
    const job = captured.json<{ id: string }>();

    const created = await app.inject({
      method: "POST",
      url: "/v1/applications",
      headers: { authorization },
      payload: { jobId: job.id, originatingTabId: 7, activeTabIds: [7, 9] },
    });
    expect(created.statusCode).toBe(201);

    const recovered = await app.inject({
      method: "GET",
      url: "/v1/applications/by-tab/9",
      headers: { authorization },
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toMatchObject({ jobId: job.id, activeTabIds: [7, 9] });

    const missing = await app.inject({
      method: "GET",
      url: "/v1/applications/by-tab/999",
      headers: { authorization },
    });
    expect(missing.statusCode).toBe(200);
    expect(missing.json()).toBeNull();

    const transitioned = await app.inject({
      method: "PATCH",
      url: `/v1/applications/${created.json<{ id: string }>().id}/state`,
      headers: { authorization },
      payload: { state: "APPLICATION_LINKED" },
    });
    expect(transitioned.statusCode).toBe(200);
    expect(transitioned.json()).toMatchObject({ state: "APPLICATION_LINKED" });

    const illegal = await app.inject({
      method: "PATCH",
      url: `/v1/applications/${created.json<{ id: string }>().id}/state`,
      headers: { authorization },
      payload: { state: "SUBMITTED" },
    });
    expect(illegal.statusCode).toBe(409);
  });
});
