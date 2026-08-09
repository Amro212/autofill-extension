import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AiService } from "../src/ai/service.js";
import { MockProvider } from "../src/ai/mock-provider.js";
import { buildApp } from "../src/app.js";
import { PairingService } from "../src/auth/pairing.js";
import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { DocumentAiService } from "../src/documents/generation.js";
import { DocumentImportService } from "../src/documents/import.js";
import { renderResumePdf } from "../src/documents/render.js";
import { DocumentStorage } from "../src/documents/storage.js";
import { DocumentStrategyService } from "../src/documents/strategy.js";
import { DocumentWorkflowService } from "../src/documents/workflow.js";
import { CanonicalResumeRepository } from "../src/repositories/canonical-resumes.js";
import { DocumentRepository } from "../src/repositories/documents.js";
import { JobRepository } from "../src/repositories/jobs.js";
import { ProfileRepository } from "../src/repositories/profile.js";
import { ApplicationRepository } from "../src/repositories/applications.js";
import { SettingsRepository } from "../src/repositories/settings.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

describe("document workflow", () => {
  it("parses an uploaded resume then generates persisted PDF and DOCX variants", async () => {
    const directory = mkdtempSync(join(tmpdir(), "job-copilot-document-workflow-"));
    const connection = openDatabase(join(directory, "workflow.sqlite"));
    migrateDatabase(connection);
    cleanups.push(() => {
      connection.close();
      rmSync(directory, { recursive: true, force: true });
    });
    const documents = new DocumentImportService(
      new DocumentStorage(join(directory, "uploads")),
      new DocumentRepository(connection.db),
    );
    const profiles = new ProfileRepository(connection.db);
    profiles.update({
      identity: { firstName: "Ada", lastName: "Lovelace" },
      contact: { email: "ada@example.com" },
    });
    const jobs = new JobRepository(connection.db);
    const job = jobs.create({
      title: "TypeScript Engineer",
      company: "Example Labs",
      descriptionNormalized: "Build reliable TypeScript services.",
    });
    const sourceBytes = await renderResumePdf({
      sourceDocumentId: "render-source",
      promptVersion: "fixture-v1",
      name: "Ada Lovelace",
      sections: [
        {
          kind: "employment",
          heading: "Experience",
          bullets: [
            {
              text: "Built reliable TypeScript services for 12 teams.",
              sourceFactIds: ["fixture-fact"],
            },
          ],
        },
      ],
    });
    const source = documents.import({
      bytes: sourceBytes,
      filename: "ada-resume.pdf",
      kind: "resume",
      mediaType: "application/pdf",
    });
    const workflow = new DocumentWorkflowService({
      canonicalResumes: new CanonicalResumeRepository(connection.db),
      documents,
      generator: new DocumentAiService(new AiService(new MockProvider())),
      jobs,
      profiles,
    });

    const parsed = await workflow.parseResume(source.id);
    const generated = await workflow.generateResume({
      sourceDocumentId: source.id,
      jobId: job.id,
      applicationId: "application-1",
      format: "both",
    });

    expect(parsed.canonical.sourceDocumentId).toBe(source.id);
    expect(generated.documents).toHaveLength(2);
    expect(generated.documents.map(({ mediaType }) => mediaType).sort()).toEqual([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    expect(generated.documents.every((document) => document.sourceDocumentId === source.id)).toBe(
      true,
    );
    expect(documents.list()).toHaveLength(3);

    const applications = new ApplicationRepository(
      connection.db,
      new SettingsRepository(connection.db),
    );
    const application = applications.create({ jobId: job.id, activeTabIds: [9] });
    const strategy = new DocumentStrategyService({
      applications,
      documents,
      workflow,
    });
    const selectedResume = await strategy.select({
      applicationId: application.id,
      kind: "resume",
    });
    const selectedLetter = await strategy.select({
      applicationId: application.id,
      kind: "cover-letter",
    });
    expect(selectedResume).toMatchObject({
      applicationId: application.id,
      jobId: job.id,
      kind: "resume",
      source: "generated",
    });
    expect(selectedLetter).toMatchObject({
      applicationId: application.id,
      jobId: job.id,
      kind: "cover-letter",
      source: "generated",
    });
    await expect(
      strategy.select({ applicationId: application.id, kind: "resume" }),
    ).resolves.toMatchObject({ id: selectedResume.id });

    const pairing = new PairingService({
      installationId: "document-workflow-test",
      pairingSecret: "setup-secret",
    });
    const app = buildApp({
      logger: false,
      pairingService: pairing,
      documentService: documents,
      documentStrategy: strategy,
      documentWorkflow: workflow,
    });
    const authorization = `Bearer ${pairing.pair("setup-secret").token}`;
    const reparsed = await app.inject({
      method: "POST",
      url: `/v1/documents/${source.id}/parse`,
      headers: { authorization },
    });
    expect(reparsed.statusCode).toBe(200);
    const letter = await app.inject({
      method: "POST",
      url: "/v1/documents/generate/cover-letter",
      headers: { authorization },
      payload: {
        sourceDocumentId: source.id,
        jobId: job.id,
        applicationId: "application-1",
        format: "pdf",
      },
    });
    expect(letter.statusCode).toBe(201);
    expect(letter.json().documents).toEqual([
      expect.objectContaining({ kind: "cover-letter", source: "generated" }),
    ]);
    const selected = await app.inject({
      method: "POST",
      url: `/v1/applications/${application.id}/documents/select`,
      headers: { authorization },
      payload: { kind: "resume" },
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json()).toMatchObject({ id: selectedResume.id });
    await app.close();
  });
});
