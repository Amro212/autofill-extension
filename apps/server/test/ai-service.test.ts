import type {
  LlmProvider,
  ProviderPrompt,
} from "@job-copilot/ai-core";
import type {
  NormalizedField,
  PageAnswerRequest,
} from "@job-copilot/contracts";
import { describe, expect, it } from "vitest";

import { AiService } from "../src/ai/service.js";
import { MockProvider } from "../src/ai/mock-provider.js";

function field(
  id: string,
  kind: NormalizedField["kind"] = "text",
  options?: NormalizedField["options"],
): NormalizedField {
  return {
    id,
    adapterId: "generic",
    pageKey: "apply",
    kind,
    label: id === "first-name" ? "First name" : id,
    required: false,
    currentValue: "",
    ...(options === undefined ? {} : { options }),
    evidence: { labelFor: true },
    confidence: 0.9,
  };
}

class ScriptedProvider implements LlmProvider {
  readonly prompts: ProviderPrompt[] = [];

  constructor(private readonly outputs: string[]) {}

  async complete(prompt: ProviderPrompt): Promise<string> {
    this.prompts.push(prompt);
    const output = this.outputs.shift();
    if (output === undefined) throw new Error("Unexpected provider call");
    return output;
  }
}

const context = {
  profile: { identity: { firstName: "Ada" }, contact: { country: "Canada" } },
  job: { company: "Example", title: "Engineer" },
  resumeFacts: ["Built a compiler"],
  memories: [],
};

function request(fields: NormalizedField[]): PageAnswerRequest {
  return { applicationId: "application-1", pageKey: "apply", fields };
}

describe("AI page service", () => {
  it("answers every ordinary field through one provider request", async () => {
    const provider = new ScriptedProvider([
      JSON.stringify({
        answers: [
          { fieldId: "first-name", value: "Ada" },
          { fieldId: "years", value: 4 },
        ],
      }),
    ]);
    const service = new AiService(provider);

    const result = await service.answerPage(
      request([field("first-name"), field("years", "number")]),
      context,
    );

    expect(result.answers).toHaveLength(2);
    expect(provider.prompts).toHaveLength(1);
    expect(provider.prompts[0]?.task).toBe("answer-page");
  });

  it("repairs malformed output once and then validates it", async () => {
    const provider = new ScriptedProvider([
      "not json",
      JSON.stringify({ answers: [{ fieldId: "first-name", value: "Ada" }] }),
    ]);
    const service = new AiService(provider, { maxRepairAttempts: 1 });

    await expect(
      service.answerPage(request([field("first-name")]), context),
    ).resolves.toMatchObject({ answers: [{ value: "Ada" }] });
    expect(provider.prompts.map((prompt) => prompt.task)).toEqual([
      "answer-page",
      "repair-json",
    ]);
  });

  it("stops after the bounded repair budget", async () => {
    const provider = new ScriptedProvider(["bad", "still bad", "unused"]);
    const service = new AiService(provider, { maxRepairAttempts: 1 });

    await expect(
      service.answerPage(request([field("first-name")]), context),
    ).rejects.toThrow();
    expect(provider.prompts).toHaveLength(2);
  });

  it("rewrites one field without making a page-answer call", async () => {
    const provider = new ScriptedProvider([
      JSON.stringify({
        fieldId: "motivation",
        value: "I build reliable systems that help teams move faster.",
      }),
    ]);
    const service = new AiService(provider);

    const result = await service.rewriteField(
      {
        applicationId: "application-1",
        field: field("motivation", "textarea"),
        currentAnswer: "I like systems.",
        feedback: "Be concrete",
      },
      context,
    );

    expect(result.fieldId).toBe("motivation");
    expect(provider.prompts.map((prompt) => prompt.task)).toEqual(["rewrite-field"]);
  });

  it("provides deterministic offline answers for tests and first-run smoke", async () => {
    const service = new AiService(new MockProvider());
    const result = await service.answerPage(
      request([
        field("first-name"),
        field("country", "native-select", [
          { label: "Canada", value: "CA" },
          { label: "United States", value: "US" },
        ]),
      ]),
      context,
    );

    expect(result.answers).toEqual([
      expect.objectContaining({ fieldId: "first-name", value: "Ada" }),
      expect.objectContaining({ fieldId: "country", value: "CA" }),
    ]);
  });
});
