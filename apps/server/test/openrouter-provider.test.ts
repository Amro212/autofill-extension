import type { ProviderPrompt } from "@job-copilot/ai-core";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OPENROUTER_MODEL,
  resolveAiProviderConfig,
} from "../src/ai/config.js";
import { OpenRouterProvider } from "../src/ai/openrouter-provider.js";

const prompt: ProviderPrompt = {
  task: "answer-page",
  system: "SYSTEM POLICY",
  user: "FIELD CONTENT",
  responseSchemaName: "page-answers",
};

describe("OpenRouter provider", () => {
  it("keeps the verified default model in server configuration only", () => {
    expect(DEFAULT_OPENROUTER_MODEL).toBe("google/gemini-3.5-flash-lite");
    expect(resolveAiProviderConfig({})).toEqual({
      kind: "mock",
      model: DEFAULT_OPENROUTER_MODEL,
    });
    expect(
      resolveAiProviderConfig({
        JOB_COPILOT_AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "server-secret",
        JOB_COPILOT_AI_MODEL: "google/gemini-3.6-flash",
      }),
    ).toEqual({
      kind: "openrouter",
      apiKey: "server-secret",
      model: "google/gemini-3.6-flash",
    });
  });

  it("sends separated messages and strict structured-output requirements", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"answers":[]}' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const provider = new OpenRouterProvider({
      apiKey: "server-secret",
      model: DEFAULT_OPENROUTER_MODEL,
      fetcher,
    });

    await expect(provider.complete(prompt)).resolves.toBe('{"answers":[]}');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer server-secret",
      "content-type": "application/json",
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: DEFAULT_OPENROUTER_MODEL,
      messages: [
        { role: "system", content: "SYSTEM POLICY" },
        { role: "user", content: "FIELD CONTENT" },
      ],
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: "page_answers", strict: true },
      },
    });
  });

  it("returns a sanitized error without echoing credentials or provider bodies", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "secret upstream detail" } }), {
        status: 401,
      }),
    );
    const provider = new OpenRouterProvider({
      apiKey: "server-secret",
      model: DEFAULT_OPENROUTER_MODEL,
      fetcher,
    });

    await expect(provider.complete(prompt)).rejects.toThrow(
      "OpenRouter request failed (401)",
    );
    await provider.complete(prompt).catch((error: Error) => {
      expect(error.message).not.toContain("server-secret");
      expect(error.message).not.toContain("upstream detail");
    });
  });
});
