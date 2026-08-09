import { describe, expect, it } from "vitest";

import {
  apiErrorSchema,
  applicantProfileSchema,
  applicationSessionSchema,
  automationSettingsSchema,
  documentMetadataSchema,
  normalizedFieldSchema,
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
