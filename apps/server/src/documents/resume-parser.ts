import { createHash } from "node:crypto";

import {
  resumeParseResultSchema,
  type ResumeParseResult,
  type ResumeSectionKind,
} from "@job-copilot/contracts";

const sectionKinds = new Map<string, ResumeSectionKind>([
  ["summary", "summary"],
  ["profile", "summary"],
  ["professional summary", "summary"],
  ["experience", "employment"],
  ["work experience", "employment"],
  ["professional experience", "employment"],
  ["employment", "employment"],
  ["education", "education"],
  ["projects", "projects"],
  ["selected projects", "projects"],
  ["skills", "skills"],
  ["technical skills", "skills"],
  ["certifications", "certifications"],
  ["licenses and certifications", "certifications"],
]);

function stableId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 16);
}

function headingKey(line: string): string {
  return line.replace(/[:|]+$/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function looksLikeUnknownHeading(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return line.length <= 80 && letters.length >= 3 && letters === letters.toLocaleUpperCase();
}

function looksLikeName(line: string): boolean {
  return (
    !/[@:/\d]/.test(line) &&
    line.split(/\s+/).length >= 2 &&
    line.split(/\s+/).length <= 5 &&
    line.length <= 80
  );
}

export function parseResumeText(text: string, sourceDocumentId: string): ResumeParseResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^[•●▪◦*-]\s*/, "").replace(/\s+/g, " ").trim());
  const unsupportedSections: string[] = [];
  const sections: Array<{
    id: string;
    kind: ResumeSectionKind;
    heading: string;
    facts: Array<{
      id: string;
      kind: ResumeSectionKind;
      text: string;
      sourceDocumentId: string;
      sourceExcerpt: string;
      sourceLine: number;
    }>;
  }> = [];
  let current: (typeof sections)[number] | undefined;
  const ensureSection = (kind: ResumeSectionKind, heading: string) => {
    current = {
      id: `section-${stableId(sourceDocumentId, heading, String(sections.length))}`,
      kind,
      heading,
      facts: [],
    };
    sections.push(current);
  };

  for (const [sourceLine, line] of lines.entries()) {
    if (line === "") continue;
    const knownKind = sectionKinds.get(headingKey(line));
    if (knownKind !== undefined) {
      ensureSection(knownKind, line.replace(/[:|]+$/g, ""));
      continue;
    }
    if (looksLikeUnknownHeading(line) && current !== undefined) {
      unsupportedSections.push(line);
      ensureSection("other", line);
      continue;
    }
    if (current === undefined) ensureSection("header", "Header");
    current!.facts.push({
      id: `fact-${stableId(sourceDocumentId, String(sourceLine), line)}`,
      kind: current!.kind,
      text: line,
      sourceDocumentId,
      sourceExcerpt: line,
      sourceLine,
    });
  }
  const populated = sections.filter(({ facts }) => facts.length > 0);
  if (populated.length === 0) throw new Error("Resume contains no structured facts");

  const headerFacts = populated.find(({ kind }) => kind === "header")?.facts ?? [];
  const name = headerFacts.map(({ text }) => text).find(looksLikeName);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(?:\+?\d[\d(). -]{7,}\d)/)?.[0]?.trim();
  const linkedin = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i)?.[0];
  const github = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s]+/i)?.[0];
  const skillNames = populated
    .filter(({ kind }) => kind === "skills")
    .flatMap(({ facts }) => facts)
    .flatMap(({ text: fact }) => fact.split(/[,;|]/))
    .map((skill) => skill.trim())
    .filter(Boolean);
  const names = name?.split(/\s+/) ?? [];
  const now = new Date().toISOString();
  return resumeParseResultSchema.parse({
    text: text.trim(),
    canonical: {
      id: `resume-${stableId(sourceDocumentId, text)}`,
      sourceDocumentId,
      ...(name === undefined ? {} : { name }),
      sections: populated,
      unsupportedSections: [...new Set(unsupportedSections)],
      extractionWarnings:
        populated.every(({ kind }) => kind === "header")
          ? ["No standard resume section headings were detected"]
          : [],
      createdAt: now,
      updatedAt: now,
    },
    profileSuggestions: {
      identity:
        names.length < 2
          ? {}
          : { firstName: names[0], lastName: names.at(-1) },
      contact: {
        ...(email === undefined ? {} : { email }),
        ...(phone === undefined ? {} : { phone }),
        ...(linkedin === undefined ? {} : { linkedin }),
        ...(github === undefined ? {} : { github }),
      },
      skills: [...new Set(skillNames)].map((skill, index) => ({
        id: `skill-${stableId(sourceDocumentId, String(index), skill)}`,
        name: skill,
      })),
    },
  });
}
