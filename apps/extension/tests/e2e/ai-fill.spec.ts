import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { buildApp } from "../../../server/src/app.js";
import { MockProvider } from "../../../server/src/ai/mock-provider.js";
import { AiService } from "../../../server/src/ai/service.js";
import { PairingService } from "../../../server/src/auth/pairing.js";
import { openDatabase } from "../../../server/src/db/client.js";
import { migrateDatabase } from "../../../server/src/db/migrate.js";
import { AnswerMemoryRepository } from "../../../server/src/memory/repository.js";
import { AnswerRecordRepository } from "../../../server/src/repositories/answers.js";
import { ApplicationRepository } from "../../../server/src/repositories/applications.js";
import { JobRepository } from "../../../server/src/repositories/jobs.js";
import { ProfileRepository } from "../../../server/src/repositories/profile.js";
import { SettingsRepository } from "../../../server/src/repositories/settings.js";

let app: ReturnType<typeof buildApp>;
let baseUrl: string;
let authorization: string;
let applicationId: string;
let answers: AnswerRecordRepository;
let closeDatabase: () => void;
let directory: string;

const firstNameField = {
  id: "name",
  adapterId: "generic",
  pageKey: "execution",
  kind: "text" as const,
  semanticType: "identity.firstName",
  label: "First name",
  required: true,
  currentValue: "",
  evidence: { labelFor: true },
  confidence: 0.95,
};

test.beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "job-copilot-ai-e2e-"));
  const connection = openDatabase(join(directory, "e2e.sqlite"));
  closeDatabase = connection.close;
  migrateDatabase(connection);
  const pairingService = new PairingService({
    installationId: "e2e-installation",
    pairingSecret: "e2e-pairing-secret",
  });
  authorization = `Bearer ${pairingService.pair("e2e-pairing-secret").token}`;
  const profiles = new ProfileRepository(connection.db);
  profiles.update({ identity: { firstName: "Grace", lastName: "Hopper" } });
  const settings = new SettingsRepository(connection.db);
  const jobs = new JobRepository(connection.db);
  const applications = new ApplicationRepository(connection.db, settings);
  const job = jobs.create({
    company: "Example Systems",
    title: "Compiler Engineer",
    listingUrl: "https://jobs.example.test/compiler",
  });
  applicationId = applications.create({ jobId: job.id, activeTabIds: [1] }).id;
  answers = new AnswerRecordRepository(connection.db);
  app = buildApp({
    logger: false,
    pairingService,
    ai: {
      service: new AiService(new MockProvider()),
      profiles,
      applications,
      jobs,
      memories: new AnswerMemoryRepository(connection.db),
      answers,
    },
  });
  baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
});

test.afterAll(async () => {
  await app.close();
  closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

test("fills, rewrites, and undoes through the paired mock AI pipeline", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const pageResponse = await request.post(`${baseUrl}/v1/ai/pages/answer`, {
    headers: { authorization },
    data: {
      applicationId,
      pageKey: "execution",
      fields: [firstNameField],
    },
  });
  expect(pageResponse.ok()).toBe(true);
  const pageAnswers = await pageResponse.json();
  await page.evaluate(
    (result) => window.executionHarness.applyPageAnswers(result),
    pageAnswers,
  );
  await expect(page.locator("#name")).toHaveValue("Grace");

  const rewriteResponse = await request.post(`${baseUrl}/v1/ai/fields/rewrite`, {
    headers: { authorization },
    data: {
      applicationId,
      field: firstNameField,
      currentAnswer: "Grace",
      feedback: "Polish",
    },
  });
  expect(rewriteResponse.ok()).toBe(true);
  const rewrite = await rewriteResponse.json();
  await page.evaluate(
    ({ result, current }) => window.executionHarness.applyRewrite(result, current),
    { result: rewrite, current: "Grace" },
  );
  await expect(page.locator("#name")).toHaveValue("Grace (rewritten)");
  await page.evaluate(() => window.executionHarness.undoFill());
  await expect(page.locator("#name")).toHaveValue("Grace");

  expect(answers.list(applicationId).map((record) => record.source)).toEqual([
    "ai",
    "rewrite",
  ]);
});
