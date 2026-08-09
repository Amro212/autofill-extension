import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PairingService } from "../src/auth/pairing.js";
import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { InstallationRepository } from "../src/repositories/installation.js";
import { ProfileRepository } from "../src/repositories/profile.js";
import { SettingsRepository } from "../src/repositories/settings.js";
import { createServerRuntime } from "../src/server.js";

const temporaryDirectories: string[] = [];

function openTemporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "job-copilot-persistence-"));
  temporaryDirectories.push(directory);
  const connection = openDatabase(join(directory, "job-copilot.sqlite"));
  migrateDatabase(connection);
  return { connection, filename: join(directory, "job-copilot.sqlite") };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite repositories", () => {
  it("persists the local user and canonical profile across restarts", () => {
    const { connection, filename } = openTemporaryDatabase();
    const profiles = new ProfileRepository(connection.db);
    const initial = profiles.get();

    expect(initial.userId).toBeTruthy();
    expect(initial.identity).toEqual({});

    profiles.update({
      identity: { firstName: "Ada", lastName: "Lovelace" },
      contact: { email: "ada@example.test", country: "CA" },
      employment: [
        {
          id: "employment-1",
          company: "Analytical Engines Ltd.",
          title: "Programmer",
          current: true,
          highlights: ["Authored an algorithm"],
        },
      ],
    });
    connection.close();

    const restarted = openDatabase(filename);
    migrateDatabase(restarted);
    const persisted = new ProfileRepository(restarted.db).get();

    expect(persisted.id).toBe(initial.id);
    expect(persisted.userId).toBe(initial.userId);
    expect(persisted.identity.firstName).toBe("Ada");
    expect(persisted.employment[0]?.company).toBe("Analytical Engines Ltd.");
    restarted.close();
  });

  it("persists settings and starts with locked safe defaults", () => {
    const { connection, filename } = openTemporaryDatabase();
    const settings = new SettingsRepository(connection.db);

    expect(settings.get()).toMatchObject({
      aiAutofill: true,
      autoContinue: true,
      autoSubmit: false,
      autopilot: false,
    });
    settings.update({ autoSubmit: true });
    connection.close();

    const restarted = openDatabase(filename);
    migrateDatabase(restarted);
    expect(new SettingsRepository(restarted.db).get().autoSubmit).toBe(true);
    restarted.close();
  });

  it("persists only pairing hashes and keeps issued tokens valid after restart", () => {
    const { connection, filename } = openTemporaryDatabase();
    const installations = new InstallationRepository(connection.db);
    const firstRun = installations.getOrCreate();

    expect(firstRun.pairingSecret).toBeTruthy();
    const firstService = PairingService.fromPersisted({
      ...firstRun,
      saveTokenHash: (hash) => installations.saveTokenHash(hash),
    });
    const issued = firstService.pair(firstRun.pairingSecret!);
    connection.close();

    const restarted = openDatabase(filename);
    migrateDatabase(restarted);
    const persisted = new InstallationRepository(restarted.db).getOrCreate();
    expect(persisted.pairingSecret).toBeUndefined();
    expect(persisted.pairingSecretHash).not.toContain(firstRun.pairingSecret!);

    const restartedService = PairingService.fromPersisted(persisted);
    expect(restartedService.verifyToken(issued.token)).toBe(true);
    restarted.close();
  });
});

describe("server runtime persistence", () => {
  it("reuses the database-backed installation instead of rotating auth on restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "job-copilot-runtime-"));
    temporaryDirectories.push(directory);
    const env = {
      JOB_COPILOT_DATA_DIR: directory,
      JOB_COPILOT_HOST: "127.0.0.1",
      JOB_COPILOT_PORT: "0",
    };
    const first = createServerRuntime(env);
    expect(first.pairingSecret).toBeTruthy();
    const issued = first.pairingService.pair(first.pairingSecret!);
    await first.close();

    const restarted = createServerRuntime(env);
    expect(restarted.pairingSecret).toBeUndefined();
    expect(restarted.pairingService.verifyToken(issued.token)).toBe(true);
    await restarted.close();
  });
});
