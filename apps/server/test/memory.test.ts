import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import { createEmployerScopeKey, rankMemories } from "../src/memory/ranking.js";
import { AnswerMemoryRepository } from "../src/memory/repository.js";
import { AnswerRecordRepository } from "../src/repositories/answers.js";
import { ApplicationRepository } from "../src/repositories/applications.js";
import { SettingsRepository } from "../src/repositories/settings.js";
import {
  createQuestionSignature,
  normalizeQuestion,
} from "../src/memory/signature.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("answer memory", () => {
  it("creates stable signatures from normalized questions", () => {
    expect(normalizeQuestion("  Why this company? (Required) * ")).toBe(
      "why this company",
    );
    expect(createQuestionSignature("Why this company?")).toBe(
      createQuestionSignature(" why this COMPANY * "),
    );
  });

  it("never ranks company-specific language for a different employer", () => {
    const candidates = [
      {
        id: "acme",
        signature: "why-company",
        normalizedQuestion: "why this company",
        value: "Acme-specific mission language",
        scope: "global" as const,
        domain: "acme.example",
        pinned: true,
        usageCount: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "generic",
        signature: "why-company",
        normalizedQuestion: "why this company",
        value: "I value technically ambitious teams.",
        scope: "global" as const,
        pinned: false,
        usageCount: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "application-only",
        signature: "why-company",
        normalizedQuestion: "why this company",
        value: "Only for another application",
        scope: "application" as const,
        sourceApplicationId: "application-other",
        pinned: true,
        usageCount: 20,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ];

    expect(
      rankMemories(candidates, {
        signature: "why-company",
        domain: "globex.example",
        applicationId: "application-current",
      }).map((memory) => memory.id),
    ).toEqual(["generic"]);
    expect(
      rankMemories(candidates, {
        signature: "why-company",
        domain: "acme.example",
        applicationId: "application-current",
      }).map((memory) => memory.id),
    ).toEqual(["acme", "generic"]);
  });

  it("does not treat a shared ATS hostname as an employer identity", () => {
    expect(
      createEmployerScopeKey({
        id: "job-acme",
        company: "Acme, Inc.",
        listingUrl: "https://boards.greenhouse.io/acme/jobs/1",
      }),
    ).toBe("company:acme inc");
    expect(
      createEmployerScopeKey({
        id: "job-globex",
        company: "Globex",
        listingUrl: "https://boards.greenhouse.io/globex/jobs/2",
      }),
    ).toBe("company:globex");
    expect(
      createEmployerScopeKey({
        id: "job-unknown",
        listingUrl: "https://boards.greenhouse.io/unknown/jobs/3",
      }),
    ).toBe("job:job-unknown");
  });

  it("persists candidates and usage across database restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "job-copilot-memory-"));
    directories.push(directory);
    const databasePath = join(directory, "memory.sqlite");
    const first = openDatabase(databasePath);
    migrateDatabase(first);
    const repository = new AnswerMemoryRepository(first.db);
    const saved = repository.remember({
      question: "Do you require sponsorship?",
      value: false,
      scope: "global",
      pinned: true,
    });
    repository.markUsed(saved.id);
    first.close();

    const second = openDatabase(databasePath);
    migrateDatabase(second);
    const recovered = new AnswerMemoryRepository(second.db).findRelevant(
      "Do you require sponsorship?",
      {},
    );

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ value: false, pinned: true, usageCount: 1 });
    second.close();
  });

  it("persists compact answer provenance and previous values", () => {
    const directory = mkdtempSync(join(tmpdir(), "job-copilot-answers-"));
    directories.push(directory);
    const databasePath = join(directory, "answers.sqlite");
    const first = openDatabase(databasePath);
    migrateDatabase(first);
    const application = new ApplicationRepository(
      first.db,
      new SettingsRepository(first.db),
    ).create({ activeTabIds: [1] });
    const repository = new AnswerRecordRepository(first.db);
    repository.record({
      applicationId: application.id,
      fieldSignature: "country",
      question: "Country",
      value: "CA",
      previousValue: "",
      source: "ai",
      confidence: 0.95,
      inferred: false,
      rationaleCode: "profile-contact-country",
    });
    first.close();

    const second = openDatabase(databasePath);
    migrateDatabase(second);
    expect(new AnswerRecordRepository(second.db).list(application.id)).toEqual([
      expect.objectContaining({
        fieldSignature: "country",
        value: "CA",
        previousValue: "",
        source: "ai",
      }),
    ]);
    second.close();
  });
});
