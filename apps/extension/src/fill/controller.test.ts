// @vitest-environment jsdom
import type {
  NormalizedField,
  PageAnswerRequest,
  PageAnswerResult,
  RewriteRequest,
  RewriteResult,
} from "@job-copilot/contracts";
import { describe, expect, it, vi } from "vitest";

import type { DiscoveredField } from "../fields/discover.js";
import { NormalizedFieldRegistry } from "../fields/registry.js";
import { FillController } from "./controller.js";

function discovered(input: HTMLInputElement): DiscoveredField {
  const field: NormalizedField = {
    id: "name",
    adapterId: "generic",
    pageKey: "apply",
    kind: "text",
    label: "Name",
    required: true,
    currentValue: "",
    evidence: { labelFor: true },
    confidence: 0.9,
  };
  return { field, elements: [input] };
}

describe("fill controller", () => {
  it("deduplicates concurrent and repeated page fills into one AI request", async () => {
    const input = document.createElement("input");
    input.scrollIntoView = vi.fn();
    const registry = new NormalizedFieldRegistry();
    registry.reconcile([discovered(input)]);
    let release!: (value: PageAnswerResult) => void;
    const answerPage = vi.fn(
      (_request: PageAnswerRequest) =>
        new Promise<PageAnswerResult>((resolve) => {
          release = resolve;
        }),
    );
    const controller = new FillController({
      registry,
      client: {
        answerPage,
        rewriteField: vi.fn<(request: RewriteRequest) => Promise<RewriteResult>>(),
      },
    });

    const first = controller.fillPage({ pageKey: "apply", applicationId: "app-1" });
    const second = controller.fillPage({ pageKey: "apply", applicationId: "app-1" });
    release({ answers: [{ fieldId: "name", value: "Ada" }] });

    await expect(first).resolves.toMatchObject({ filled: 1, failed: 0 });
    await expect(second).resolves.toMatchObject({ filled: 1, failed: 0 });
    await controller.fillPage({ pageKey: "apply", applicationId: "app-1" });
    expect(answerPage).toHaveBeenCalledTimes(1);
    expect(answerPage).toHaveBeenCalledWith({
      pageKey: "apply",
      applicationId: "app-1",
      fields: [expect.objectContaining({ id: "name" })],
    });
    expect(input.value).toBe("Ada");
  });

  it("rewrites one field and can undo its verified mutation", async () => {
    const input = document.createElement("input");
    input.value = "Old answer";
    input.scrollIntoView = vi.fn();
    const registry = new NormalizedFieldRegistry();
    registry.reconcile([discovered(input)]);
    const rewriteField = vi
      .fn<(request: RewriteRequest) => Promise<RewriteResult>>()
      .mockResolvedValue({ fieldId: "name", value: "Better answer" });
    const controller = new FillController({
      registry,
      client: {
        answerPage: vi.fn<(request: PageAnswerRequest) => Promise<PageAnswerResult>>(),
        rewriteField,
      },
    });

    await expect(
      controller.rewrite("name", {
        applicationId: "app-1",
        currentAnswer: "Old answer",
        feedback: "Be concise",
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(input.value).toBe("Better answer");
    expect(rewriteField).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        field: expect.objectContaining({ id: "name" }),
        currentAnswer: "Old answer",
      }),
    );

    await expect(controller.undoLast()).resolves.toMatchObject({ ok: true });
    expect(input.value).toBe("Old answer");
  });
});
