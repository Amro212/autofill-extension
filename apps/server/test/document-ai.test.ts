import { describe, expect, it } from "vitest";

import type { CanonicalResume, TailoredResume } from "@job-copilot/contracts";

import { extractDocumentText } from "../src/documents/extract.js";
import { parseResumeText } from "../src/documents/resume-parser.js";
import {
  renderCoverLetterDocx,
  renderCoverLetterPdf,
  renderResumeDocx,
  renderResumePdf,
} from "../src/documents/render.js";
import { validateCoverLetterTruth, validateTailoredResumeTruth } from "../src/documents/truth.js";

const sourceText = `Ada Lovelace
ada@example.com · Toronto, Canada

EXPERIENCE
Example Corp — Software Engineer
Built TypeScript services used by 12 internal teams.

SKILLS
TypeScript, Node.js, SQL

PUBLICATIONS
Notes on reliable analytical engines`;

describe("document AI", () => {
  it("parses canonical facts, profile suggestions, and unsupported sections without loss", () => {
    const result = parseResumeText(sourceText, "source-document-1");

    expect(result.canonical.name).toBe("Ada Lovelace");
    expect(result.profileSuggestions.contact?.email).toBe("ada@example.com");
    expect(result.profileSuggestions.skills?.map(({ name }) => name)).toEqual([
      "TypeScript",
      "Node.js",
      "SQL",
    ]);
    expect(result.canonical.unsupportedSections).toContain("PUBLICATIONS");
    expect(result.canonical.sections.flatMap(({ facts }) => facts.map(({ text }) => text))).toContain(
      "Notes on reliable analytical engines",
    );
  });

  it("renders text-selectable PDF and DOCX resumes that round-trip through extraction", async () => {
    const canonical = parseResumeText(sourceText, "source-document-1").canonical;
    const tailored: TailoredResume = {
      sourceDocumentId: canonical.sourceDocumentId,
      promptVersion: "resume-tailor-v1",
      name: canonical.name,
      sections: canonical.sections.map((section) => ({
        kind: section.kind,
        heading: section.heading,
        bullets: section.facts.map((fact) => ({ text: fact.text, sourceFactIds: [fact.id] })),
      })),
    };

    const [pdf, docx] = await Promise.all([renderResumePdf(tailored), renderResumeDocx(tailored)]);
    const [pdfText, docxText] = await Promise.all([
      extractDocumentText(pdf, "application/pdf"),
      extractDocumentText(
        docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ]);

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(docx.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(pdfText).toContain("Ada Lovelace");
    expect(pdfText).toContain("TypeScript services");
    expect(docxText).toContain("Ada Lovelace");
    expect(docxText).toContain("TypeScript services");
  });

  it("rejects untraceable resume and cover-letter claims", async () => {
    const canonical: CanonicalResume = parseResumeText(
      sourceText,
      "source-document-1",
    ).canonical;
    const sourceFact = canonical.sections
      .flatMap(({ facts }) => facts)
      .find(({ text }) => text.includes("TypeScript services"))!;
    const fabricated: TailoredResume = {
      sourceDocumentId: canonical.sourceDocumentId,
      promptVersion: "resume-tailor-v1",
      sections: [
        {
          kind: "employment",
          heading: "Experience",
          bullets: [
            {
              text: "Built TypeScript services that reduced costs by 40%.",
              sourceFactIds: [sourceFact.id],
            },
          ],
        },
      ],
    };

    expect(() => validateTailoredResumeTruth(fabricated, canonical)).toThrow("Unsupported claim");
    expect(() =>
      validateCoverLetterTruth(
        {
          promptVersion: "cover-letter-v1",
          paragraphs: [{ text: "I led 40 engineers.", sourceFactIds: [sourceFact.id] }],
        },
        canonical,
      ),
    ).toThrow("Unsupported claim");
  });

  it("renders evidence-linked cover letters to PDF and DOCX", async () => {
    const canonical = parseResumeText(sourceText, "source-document-1").canonical;
    const sourceFact = canonical.sections.flatMap(({ facts }) => facts)[2]!;
    const letter = {
      promptVersion: "cover-letter-v1",
      recipient: "Hiring team",
      subject: "Software Engineer application",
      paragraphs: [{ text: sourceFact.text, sourceFactIds: [sourceFact.id] }],
    };
    validateCoverLetterTruth(letter, canonical);

    const [pdf, docx] = await Promise.all([
      renderCoverLetterPdf(letter),
      renderCoverLetterDocx(letter),
    ]);
    expect(await extractDocumentText(pdf, "application/pdf")).toContain(sourceFact.text);
    expect(
      await extractDocumentText(
        docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toContain(sourceFact.text);
  });
});
