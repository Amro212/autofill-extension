// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { DebugJournal } from "./journal.js";

describe("debug journal", () => {
  it("bounds events and strips values, credentials, and common PII from exports", () => {
    const journal = new DebugJournal({ maxEvents: 2 });
    journal.record("scan", { adapter: "greenhouse", count: 4 });
    journal.record("field-action", {
      fieldId: "field-1",
      value: "Ada Secret",
      message: "Failed for ada@example.com with Bearer private-token",
    });
    journal.record("provider", {
      task: "answer-page",
      prompt: "private applicant facts",
      output: "private model response",
    });

    const bundle = journal.bundle({
      adapterId: "greenhouse",
      sessionId: "application-1",
      page: new URL("https://job-boards.greenhouse.io/acme/jobs/123?candidate=ada#apply"),
      fields: [{ id: "field-1", kind: "email", label: "Email", required: true }],
    });
    const serialized = JSON.stringify(bundle);

    expect(bundle.events).toHaveLength(2);
    expect(bundle.page).toEqual({
      origin: "https://job-boards.greenhouse.io",
      pathname: "/acme/jobs/123",
    });
    expect(serialized).not.toContain("Ada Secret");
    expect(serialized).not.toContain("ada@example.com");
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("private applicant facts");
    expect(serialized).not.toContain("private model response");
    expect(serialized).toContain("[REDACTED]");
  });
});
