import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NormalizedField } from "@job-copilot/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { AiService } from "../src/ai/service.js";
import { MockProvider } from "../src/ai/mock-provider.js";
import { PairingService } from "../src/auth/pairing.js";
import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { AnswerMemoryRepository } from "../src/memory/repository.js";
import { ApplicationRepository } from "../src/repositories/applications.js";
import { AnswerRecordRepository } from "../src/repositories/answers.js";
import { JobRepository } from "../src/repositories/jobs.js";
import { ProfileRepository } from "../src/repositories/profile.js";
import { SettingsRepository } from "../src/repositories/settings.js";

const cleanups: Array<() => Promise<void> | void> = [];

function firstNameField(): NormalizedField {
  return {
    id: "first-name",
    adapterId: "generic",
    pageKey: "apply",
    kind: "text",
    semanticType: "identity.firstName",
    label: "First name",
    required: true,
    currentValue: "",
    evidence: { labelFor: true },
    confidence: 0.95,
  };
}

async function createAuthenticatedApp() {
  const directory = mkdtempSync(join(tmpdir(), "job-copilot-ai-api-"));
  const connection = openDatabase(join(directory, "api.sqlite"));
  migrateDatabase(connection);
  const pairingService = new PairingService({
    installationId: "installation-1",
    pairingSecret: "setup-secret",
  });
  const profiles = new ProfileRepository(connection.db);
  profiles.update({ identity: { firstName: "Grace", lastName: "Hopper" } });
  const settings = new SettingsRepository(connection.db);
  const app = buildApp({
    logger: false,
    pairingService,
    profileRepository: profiles,
    ai: {
      service: new AiService(new MockProvider()),
      profiles,
      applications: new ApplicationRepository(connection.db, settings),
      jobs: new JobRepository(connection.db),
      memories: new AnswerMemoryRepository(connection.db),
      answers: new AnswerRecordRepository(connection.db),
    },
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

describe("AI API", () => {
  it("lists stored answer memory for user review", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    await app.inject({
      method: "POST",
      url: "/v1/ai/pages/answer",
      headers: { authorization },
      payload: { pageKey: "apply", fields: [firstNameField()] },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/memories",
      headers: { authorization },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({ normalizedQuestion: "first name", scope: "global" }),
    ]);
  });

  it("loads applicant facts on the backend and answers a page once", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/ai/pages/answer",
      headers: { authorization },
      payload: { pageKey: "apply", fields: [firstNameField()] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      answers: [{ fieldId: "first-name", value: "Grace" }],
    });
  });

  it("requires pairing and rejects profile data crossing from the extension", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/v1/ai/pages/answer",
      payload: { pageKey: "apply", fields: [firstNameField()] },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const overbroad = await app.inject({
      method: "POST",
      url: "/v1/ai/pages/answer",
      headers: { authorization },
      payload: {
        pageKey: "apply",
        fields: [firstNameField()],
        profile: { identity: { firstName: "Injected" } },
      },
    });
    expect(overbroad.statusCode).toBe(400);
    expect(overbroad.json().error.code).toBe("VALIDATION_FAILED");
  });

  it("rewrites only the requested field", async () => {
    const { app, authorization } = await createAuthenticatedApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/ai/fields/rewrite",
      headers: { authorization },
      payload: {
        field: { ...firstNameField(), kind: "textarea", id: "motivation" },
        currentAnswer: "I enjoy systems.",
        feedback: "Polish",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fieldId: "motivation",
      value: "I enjoy systems. (rewritten)",
    });
  });
});
