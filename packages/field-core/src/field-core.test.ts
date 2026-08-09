import { describe, expect, it } from "vitest";

import {
  createFieldSignature,
  matchOption,
  normalizeLabel,
  selectBestLabel,
} from "./index.js";

describe("field label normalization", () => {
  it("uses explicit semantic evidence before placeholders", () => {
    expect(
      selectBestLabel({
        placeholder: "you@example.test",
        ariaLabel: "Contact email",
        labelFor: "Email address *",
      }),
    ).toEqual({ label: "Email address", source: "labelFor" });
  });

  it("normalizes whitespace and required suffixes", () => {
    expect(normalizeLabel("  Work   authorization (required) * ")).toBe(
      "Work authorization",
    );
  });
});

describe("field signatures and options", () => {
  it("keeps repeat instances distinct while remaining deterministic", () => {
    const first = createFieldSignature({
      pageKey: "apply",
      kind: "text",
      label: "Company",
      section: "Employment 1",
      ordinal: 0,
    });
    expect(
      createFieldSignature({
        pageKey: "apply",
        kind: "text",
        label: "Company",
        section: "Employment 1",
        ordinal: 0,
      }),
    ).toBe(first);
    expect(
      createFieldSignature({
        pageKey: "apply",
        kind: "text",
        label: "Company",
        section: "Employment 2",
        ordinal: 1,
      }),
    ).not.toBe(first);
  });

  it("matches exact normalized options before safe word overlap", () => {
    const options = [
      { label: "United States", value: "US" },
      { label: "United States Minor Outlying Islands", value: "UM" },
    ];
    expect(matchOption(options, "united states")?.value).toBe("US");
    expect(matchOption(options, "States United")?.value).toBe("US");
    expect(matchOption(options, "unknown")).toBeUndefined();
  });
});

