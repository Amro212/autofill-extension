import { describe, expect, it } from "vitest";

import {
  apiErrorSchema,
  answerRecordSchema,
  applicantProfileSchema,
  applicationSessionSchema,
  automationSettingsSchema,
  documentMetadataSchema,
  jobCaptureSchema,
  normalizedFieldSchema,
  pageAnswerRequestSchema,
  pageAnswerResultSchema,
  rewriteRequestSchema,
} from "./index.js";

describe("normalizedFieldSchema", () => {
  it("accepts one serializable field with evidence", () => {
    const field = normalizedFieldSchema.parse({
      id: "field-1",
      adapterId: "generic",
      pageKey: "page-1",
      kind: "email",
      label: "Email address",
      required: true,
      currentValue: "",
      evidence: { labelFor: true },
      confidence: 0.98,
    });

    expect(field.kind).toBe("email");
    expect(field.evidence.labelFor).toBe(true);
  });

  it("rejects non-serializable current values", () => {
    expect(() =>
      normalizedFieldSchema.parse({
        id: "field-1",
        adapterId: "generic",
        pageKey: "page-1",
        kind: "text",
        label: "Name",
        required: false,
        currentValue: document,
        evidence: {},
        confidence: 0.8,
      }),
    ).toThrow();
  });
});

describe("applicationSessionSchema", () => {
  it("applies locked automation defaults", () => {
    const session = applicationSessionSchema.parse({
      id: "application-1",
      userId: "user-1",
      state: "DISCOVERED",
      createdAt: "2026-08-08T12:00:00.000Z",
      updatedAt: "2026-08-08T12:00:00.000Z",
    });

    expect(session.aiAutofill).toBe(true);
    expect(session.autoContinue).toBe(true);
    expect(session.autoSubmit).toBe(false);
    expect(session.autopilot).toBe(false);
  });
});

describe("apiErrorSchema", () => {
  it("accepts a typed public error without sensitive details", () => {
    expect(
      apiErrorSchema.parse({
        error: {
          code: "BACKEND_UNPAIRED",
          message: "Pair extension before continuing",
        },
      }),
    ).toEqual({
      error: {
        code: "BACKEND_UNPAIRED",
        message: "Pair extension before continuing",
      },
    });
  });
});

describe("applicantProfileSchema", () => {
  it("creates an empty canonical profile without losing repeatable sections", () => {
    const profile = applicantProfileSchema.parse({
      id: "profile-1",
      userId: "user-1",
      identity: { firstName: "Ada", lastName: "Lovelace" },
      contact: { email: "ada@example.test" },
      createdAt: "2026-08-08T12:00:00.000Z",
      updatedAt: "2026-08-08T12:00:00.000Z",
    });

    expect(profile.education).toEqual([]);
    expect(profile.employment).toEqual([]);
    expect(profile.projects).toEqual([]);
    expect(profile.skills).toEqual([]);
    expect(profile.certifications).toEqual([]);
    expect(profile.customFacts).toEqual({});
  });

  it("rejects malformed contact data", () => {
    expect(() =>
      applicantProfileSchema.parse({
        id: "profile-1",
        userId: "user-1",
        identity: {},
        contact: { email: "not-an-email" },
        createdAt: "2026-08-08T12:00:00.000Z",
        updatedAt: "2026-08-08T12:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("automationSettingsSchema", () => {
  it("applies the product's locked safe defaults", () => {
    const settings = automationSettingsSchema.parse({
      userId: "user-1",
      updatedAt: "2026-08-08T12:00:00.000Z",
    });

    expect(settings).toMatchObject({
      aiAutofill: true,
      autoContinue: true,
      autoSubmit: false,
      autopilot: false,
    });
  });
});

describe("documentMetadataSchema", () => {
  it("exposes document metadata without an internal filesystem key", () => {
    const document = documentMetadataSchema.parse({
      id: "document-1",
      userId: "user-1",
      kind: "resume",
      source: "uploaded",
      originalFilename: "resume.pdf",
      mediaType: "application/pdf",
      sizeBytes: 128,
      sha256: "a".repeat(64),
      isDefault: true,
      createdAt: "2026-08-08T12:00:00.000Z",
    });

    expect(document).not.toHaveProperty("storageKey");
  });
});

describe("jobCaptureSchema", () => {
  it("normalizes absent job sections to stable arrays", () => {
    const job = jobCaptureSchema.parse({
      title: "Engineer",
      listingUrl: "https://example.test/jobs/1",
    });
    expect(job.requirements).toEqual([]);
    expect(job.responsibilities).toEqual([]);
  });

  it("rejects an empty capture", () => {
    expect(() => jobCaptureSchema.parse({})).toThrow();
  });
});

describe("AI page contracts", () => {
  const field = {
    id: "country",
    adapterId: "generic",
    pageKey: "apply-1",
    kind: "native-select",
    label: "Country",
    required: true,
    currentValue: "",
    options: [{ label: "Canada", value: "CA" }],
    evidence: { labelFor: true },
    confidence: 0.9,
  };

  it("accepts one serializable page request and structured answer set", () => {
    expect(
      pageAnswerRequestSchema.parse({
        applicationId: "application-1",
        pageKey: "apply-1",
        fields: [field],
      }).fields,
    ).toHaveLength(1);
    expect(
      pageAnswerResultSchema.parse({
        answers: [
          {
            fieldId: "country",
            value: "CA",
            confidence: 0.98,
            inferred: false,
            rationaleCode: "profile-contact-country",
          },
        ],
      }).answers[0]?.value,
    ).toBe("CA");
  });

  it("rejects prose-shaped output and oversized values", () => {
    expect(() => pageAnswerResultSchema.parse({ answer: "Canada" })).toThrow();
    expect(() =>
      pageAnswerResultSchema.parse({
        answers: [{ fieldId: "country", value: "x".repeat(20_001) }],
      }),
    ).toThrow();
  });

  it("keeps rewrite scoped to one known field", () => {
    expect(
      rewriteRequestSchema.parse({
        applicationId: "application-1",
        field,
        currentAnswer: "I enjoy building reliable systems.",
        feedback: "Make it more specific",
      }).field.id,
    ).toBe("country");
  });

  it("retains answer provenance without chain-of-thought", () => {
    const record = answerRecordSchema.parse({
      id: "answer-1",
      applicationId: "application-1",
      fieldSignature: "country",
      question: "Country",
      value: "CA",
      previousValue: "",
      source: "ai",
      confidence: 0.95,
      inferred: false,
      rationaleCode: "profile-contact-country",
      createdAt: "2026-08-09T00:00:00.000Z",
    });

    expect(record.source).toBe("ai");
    expect(record).not.toHaveProperty("reasoning");
  });
});
