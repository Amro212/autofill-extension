import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { PairingService } from "../src/auth/pairing.js";
import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { ProfileRepository } from "../src/repositories/profile.js";
import { SettingsRepository } from "../src/repositories/settings.js";

const cleanups: Array<() => Promise<void> | void> = [];

async function createAuthenticatedApp() {
  const directory = mkdtempSync(join(tmpdir(), "job-copilot-api-"));
  const connection = openDatabase(join(directory, "api.sqlite"));
  migrateDatabase(connection);
  const pairingService = new PairingService({
    installationId: "installation-1",
    pairingSecret: "setup-secret",
  });
  const app = buildApp({
    logger: false,
    pairingService,
    profileRepository: new ProfileRepository(connection.db),
    settingsRepository: new SettingsRepository(connection.db),
  });
  cleanups.push(async () => {
    await app.close();
    connection.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const token = pairingService.pair("setup-secret").token;
  return { app, authorization: `Bearer ${token}` };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("profile and settings API", () => {
  it("requires pairing for profile access", async () => {
    const { app } = await createAuthenticatedApp();
    const response = await app.inject({ method: "GET", url: "/v1/profile" });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("BACKEND_UNPAIRED");
  });

  it("edits profile data through authenticated validated routes", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    const update = await app.inject({
      method: "PATCH",
      url: "/v1/profile",
      headers: { authorization },
      payload: {
        identity: { firstName: "Grace", lastName: "Hopper" },
        contact: { email: "grace@example.test" },
      },
    });

    expect(update.statusCode).toBe(200);
    expect(update.json().identity.firstName).toBe("Grace");

    const read = await app.inject({
      method: "GET",
      url: "/v1/profile",
      headers: { authorization },
    });
    expect(read.json().contact.email).toBe("grace@example.test");
  });

  it("rejects malformed profile payloads without changing stored data", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    const response = await app.inject({
      method: "PATCH",
      url: "/v1/profile",
      headers: { authorization },
      payload: { contact: { email: "not-an-email" } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_FAILED");
    const read = await app.inject({
      method: "GET",
      url: "/v1/profile",
      headers: { authorization },
    });
    expect(read.json().contact).toEqual({});
  });

  it("reads and edits safe automation settings", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    const initial = await app.inject({
      method: "GET",
      url: "/v1/settings",
      headers: { authorization },
    });
    expect(initial.json()).toMatchObject({ autoContinue: true, autoSubmit: false });

    const updated = await app.inject({
      method: "PATCH",
      url: "/v1/settings",
      headers: { authorization },
      payload: { autoContinue: false, autoSubmit: true },
    });
    expect(updated.json()).toMatchObject({ autoContinue: false, autoSubmit: true });
  });
});

