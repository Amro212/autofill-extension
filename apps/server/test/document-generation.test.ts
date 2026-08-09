import { describe, expect, it } from "vitest";

import type { LlmProvider, ProviderPrompt } from "@job-copilot/ai-core";
import type { ApplicantProfileData, JobCapture } from "@job-copilot/contracts";

import { AiService } from "../src/ai/service.js";
import { MockProvider } from "../src/ai/mock-provider.js";
import { DocumentAiService } from "../src/documents/generation.js";
import { parseResumeText } from "../src/documents/resume-parser.js";

const profile: ApplicantProfileData = {
  identity: { firstName: "Ada", lastName: "Lovelace" },
  contact: { email: "ada@example.com" },
  education: [],
  employment: [],
  projects: [],
  skills: [],
  certifications: [],
  eligibility: {},
  preferences: {},
  customFacts: {},
};

const job: JobCapture = {
  company: "Example Labs",
  title: "TypeScript Engineer",
  descriptionNormalized: "Build reliable TypeScript and Node.js services.",
};

const canonical = parseResumeText(
  `Ada Lovelace

EXPERIENCE
Built reliable TypeScript and Node.js services for 12 teams.
Documented analytical engines for maintainers.

SKILLS
TypeScript, Node.js, SQL`,
  "source-document-1",
).canonical;

describe("AI document generation", () => {
  it("tailors a resume and generates a cover letter with source-fact provenance", async () => {
    const service = new DocumentAiService(new AiService(new MockProvider()));

    const resume = await service.tailorResume({
      sourceDocumentId: canonical.sourceDocumentId,
      canonical,
      profile,
      job,
      format: "both",
    });
    const letter = await service.generateCoverLetter({
      sourceDocumentId: canonical.sourceDocumentId,
      canonical,
      profile,
      job,
      format: "both",
    });

    expect(resume.sections.flatMap(({ bullets }) => bullets)[0]?.text).toContain("TypeScript");
    expect(resume.sections.flatMap(({ bullets }) => bullets).every((fact) => fact.sourceFactIds.length > 0)).toBe(
      true,
    );
    expect(letter.paragraphs).toHaveLength(3);
    expect(letter.paragraphs.every((paragraph) => paragraph.sourceFactIds.length > 0)).toBe(true);
  });

  it("rejects a provider response that invents an unsupported metric", async () => {
    const sourceFact = canonical.sections.flatMap(({ facts }) => facts)[1]!;
    const provider: LlmProvider = {
      async complete(prompt: ProviderPrompt) {
        if (prompt.task !== "tailor-resume") throw new Error("Unexpected task");
        return JSON.stringify({
          sourceDocumentId: canonical.sourceDocumentId,
          promptVersion: "resume-tailor-v1",
          sections: [
            {
              kind: "employment",
              heading: "Experience",
              bullets: [
                {
                  text: "Reduced infrastructure costs by 40%.",
                  sourceFactIds: [sourceFact.id],
                },
              ],
            },
          ],
        });
      },
    };
    const service = new DocumentAiService(new AiService(provider));

    await expect(
      service.tailorResume({
        sourceDocumentId: canonical.sourceDocumentId,
        canonical,
        profile,
        job,
        format: "pdf",
      }),
    ).rejects.toThrow("Unsupported claim");
  });
});
