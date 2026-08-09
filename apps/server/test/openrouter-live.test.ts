import { describe, expect, it } from "vitest";

import { resolveAiProviderConfig } from "../src/ai/config.js";
import { OpenRouterProvider } from "../src/ai/openrouter-provider.js";
import { AiService } from "../src/ai/service.js";

const live =
  process.env.JOB_COPILOT_LIVE_AI === "1" &&
  process.env.JOB_COPILOT_AI_PROVIDER === "openrouter" &&
  typeof process.env.OPENROUTER_API_KEY === "string";

describe.runIf(live)("OpenRouter live opt-in", () => {
  it("returns one schema-valid answer through the configured model", async () => {
    const config = resolveAiProviderConfig(process.env);
    if (config.kind !== "openrouter") throw new TypeError("OpenRouter not configured");
    const service = new AiService(new OpenRouterProvider(config));
    const result = await service.answerPage(
      {
        pageKey: "live-smoke",
        fields: [
          {
            id: "first-name",
            adapterId: "live-smoke",
            pageKey: "live-smoke",
            kind: "text",
            semanticType: "identity.firstName",
            label: "First name",
            required: true,
            currentValue: "",
            evidence: { adapterRule: "live-smoke" },
            confidence: 1,
          },
        ],
      },
      {
        profile: { identity: { firstName: "Ada" } },
        job: { company: "Example", title: "Engineer" },
        resumeFacts: [],
        memories: [],
      },
    );

    expect(result.answers).toEqual([
      expect.objectContaining({ fieldId: "first-name", value: "Ada" }),
    ]);
  });
});
