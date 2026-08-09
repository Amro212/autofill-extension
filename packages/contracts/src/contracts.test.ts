import { describe, expect, it } from "vitest";

import {
  apiErrorSchema,
  applicationSessionSchema,
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
