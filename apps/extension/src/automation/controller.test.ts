// @vitest-environment jsdom
import type { ApplicationState } from "@job-copilot/contracts";
import { describe, expect, it, vi } from "vitest";

import { PageAutomationController } from "./controller.js";

function transitionRecorder() {
  const states: ApplicationState[] = [];
  return {
    states,
    transition: vi.fn(async (state: ApplicationState) => {
      states.push(state);
      return state;
    }),
  };
}

const baseInput = {
  applicationId: "application-1",
  pageKey: "apply",
  state: "APPLICATION_LINKED" as const,
  classification: { type: "application" as const, confidence: 0.95, evidence: [] },
  settings: { autoContinue: true, autoSubmit: false },
};

describe("page automation coordinator", () => {
  it("repairs validation before continuing and persists the complete state path", async () => {
    const recorded = transitionRecorder();
    const advance = vi.fn().mockResolvedValue({ status: "navigated", attempts: 1 });
    const inspectValidation = vi
      .fn()
      .mockReturnValueOnce([
        { code: "aria-invalid", message: "Use a full city", severity: "error" },
      ])
      .mockReturnValue([]);
    const controller = new PageAutomationController({
      transition: recorded.transition,
      fillPage: vi.fn().mockResolvedValue({ filled: 1, failed: 0, results: [] }),
      uploadDocuments: vi.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
      inspectValidation,
      repairPage: vi.fn().mockResolvedValue({ repaired: true, issues: [] }),
      advance,
    });

    await expect(controller.run(document, baseInput)).resolves.toMatchObject({
      status: "navigated",
    });
    expect(recorded.states).toEqual([
      "SCANNING",
      "GENERATING",
      "FILLING",
      "VERIFYING_FIELDS",
      "VALIDATING_PAGE",
      "REPAIRING",
      "VALIDATING_PAGE",
      "READY_TO_CONTINUE",
      "NAVIGATING",
      "SCANNING",
    ]);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("stops at final review by default and submits only a confident verified final page", async () => {
    const first = transitionRecorder();
    const advance = vi.fn().mockResolvedValue({ status: "submitted", attempts: 1 });
    const common = {
      fillPage: vi.fn().mockResolvedValue({ filled: 1, failed: 0, results: [] }),
      uploadDocuments: vi.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
      inspectValidation: vi.fn().mockReturnValue([]),
      repairPage: vi.fn(),
      advance,
    };
    const classification = { type: "review" as const, confidence: 0.96, evidence: [] };

    const stopped = new PageAutomationController({ ...common, transition: first.transition });
    await expect(
      stopped.run(document, { ...baseInput, classification }),
    ).resolves.toMatchObject({ status: "review-required" });
    expect(first.states.at(-1)).toBe("READY_TO_SUBMIT");
    expect(advance).not.toHaveBeenCalled();

    const second = transitionRecorder();
    const submitted = new PageAutomationController({ ...common, transition: second.transition });
    await expect(
      submitted.run(document, {
        ...baseInput,
        classification,
        settings: { autoContinue: true, autoSubmit: true },
      }),
    ).resolves.toMatchObject({ status: "submitted" });
    expect(second.states.slice(-3)).toEqual(["READY_TO_SUBMIT", "SUBMITTING", "SUBMITTED"]);
  });

  it("only observes CAPTCHA and resumes scanning when it clears", async () => {
    document.body.innerHTML = '<div class="h-captcha"></div>';
    const recorded = transitionRecorder();
    const fillPage = vi.fn();
    const controller = new PageAutomationController({
      transition: recorded.transition,
      fillPage,
      uploadDocuments: vi.fn(),
      inspectValidation: vi.fn(),
      repairPage: vi.fn(),
      advance: vi.fn(),
      waitForCaptchaClear: vi.fn().mockResolvedValue(true),
    });

    await expect(
      controller.run(document, {
        ...baseInput,
        classification: { type: "captcha", confidence: 1, evidence: [] },
      }),
    ).resolves.toMatchObject({ status: "captcha-cleared" });
    expect(recorded.states).toEqual(["SCANNING", "AWAITING_CAPTCHA", "SCANNING"]);
    expect(fillPage).not.toHaveBeenCalled();
  });

  it("pauses immediately at a hard user boundary", async () => {
    document.body.innerHTML = "<h1>Coding assessment</h1>";
    const recorded = transitionRecorder();
    const advance = vi.fn();
    const controller = new PageAutomationController({
      transition: recorded.transition,
      fillPage: vi.fn(),
      uploadDocuments: vi.fn(),
      inspectValidation: vi.fn(),
      repairPage: vi.fn(),
      advance,
    });

    await expect(
      controller.run(document, {
        ...baseInput,
        classification: { type: "boundary", confidence: 1, evidence: [] },
      }),
    ).resolves.toMatchObject({ status: "user-boundary" });
    expect(recorded.states).toEqual(["SCANNING", "USER_BOUNDARY"]);
    expect(advance).not.toHaveBeenCalled();
  });

  it("resumes scanning after the user clears a previously reported boundary", async () => {
    document.body.innerHTML = "<form><h1>Application</h1></form>";
    const recorded = transitionRecorder();
    const controller = new PageAutomationController({
      transition: recorded.transition,
      fillPage: vi.fn().mockResolvedValue({ filled: 0, failed: 0, results: [] }),
      uploadDocuments: vi.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
      inspectValidation: vi.fn().mockReturnValue([]),
      repairPage: vi.fn(),
      advance: vi.fn(),
    });

    await expect(
      controller.run(document, {
        ...baseInput,
        state: "USER_BOUNDARY",
        settings: { autoContinue: false, autoSubmit: false },
      }),
    ).resolves.toMatchObject({ status: "paused" });
    expect(recorded.states[0]).toBe("SCANNING");
    expect(recorded.states.at(-1)).toBe("READY_TO_CONTINUE");
  });

  it("can submit a verified review already waiting in READY_TO_SUBMIT", async () => {
    document.body.innerHTML = '<button type="submit">Submit application</button>';
    const recorded = transitionRecorder();
    const advance = vi.fn().mockResolvedValue({ status: "submitted", attempts: 1 });
    const controller = new PageAutomationController({
      transition: recorded.transition,
      fillPage: vi.fn(),
      uploadDocuments: vi.fn(),
      inspectValidation: vi.fn().mockReturnValue([]),
      repairPage: vi.fn(),
      advance,
    });

    await expect(
      controller.run(document, {
        ...baseInput,
        state: "READY_TO_SUBMIT",
        classification: { type: "review", confidence: 0.96, evidence: [] },
        settings: { autoContinue: true, autoSubmit: true },
      }),
    ).resolves.toMatchObject({ status: "submitted" });
    expect(recorded.states).toEqual(["SUBMITTING", "SUBMITTED"]);
  });

  it("persists FAILED when page generation throws instead of leaving an active state", async () => {
    const recorded = transitionRecorder();
    const controller = new PageAutomationController({
      transition: recorded.transition,
      fillPage: vi.fn().mockRejectedValue(new Error("provider unavailable")),
      uploadDocuments: vi.fn(),
      inspectValidation: vi.fn(),
      repairPage: vi.fn(),
      advance: vi.fn(),
    });

    await expect(controller.run(document, baseInput)).resolves.toMatchObject({ status: "failed" });
    expect(recorded.states).toEqual(["SCANNING", "GENERATING", "FAILED"]);
  });
});
