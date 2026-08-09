import {
  coverLetterResultSchema,
  tailoredResumeSchema,
  type CanonicalResume,
  type CoverLetterResult,
  type GeneratedFact,
  type TailoredResume,
} from "@job-copilot/contracts";

function numericClaims(value: string): string[] {
  return value.toLocaleLowerCase().match(/\b\d[\d,.%+-]*\b/g) ?? [];
}

function validateFacts(generated: GeneratedFact[], canonical: CanonicalResume): void {
  const source = new Map(
    canonical.sections.flatMap(({ facts }) => facts).map((fact) => [fact.id, fact]),
  );
  for (const item of generated) {
    const cited = item.sourceFactIds.map((id) => {
      const fact = source.get(id);
      if (fact === undefined) throw new Error(`Unknown source fact: ${id}`);
      return fact.sourceExcerpt;
    });
    const evidence = cited.join(" ").toLocaleLowerCase();
    const unsupported = numericClaims(item.text).filter((claim) => !evidence.includes(claim));
    if (unsupported.length > 0) {
      throw new Error(`Unsupported claim: ${unsupported.join(", ")}`);
    }
  }
}

export function validateTailoredResumeTruth(
  input: TailoredResume,
  canonical: CanonicalResume,
): TailoredResume {
  const tailored = tailoredResumeSchema.parse(input);
  if (tailored.sourceDocumentId !== canonical.sourceDocumentId) {
    throw new Error("Tailored resume source does not match canonical resume");
  }
  validateFacts(
    [
      ...(tailored.summary === undefined ? [] : [tailored.summary]),
      ...tailored.sections.flatMap(({ bullets }) => bullets),
    ],
    canonical,
  );
  return tailored;
}

export function validateCoverLetterTruth(
  input: CoverLetterResult,
  canonical: CanonicalResume,
): CoverLetterResult {
  const letter = coverLetterResultSchema.parse(input);
  validateFacts(letter.paragraphs, canonical);
  return letter;
}
