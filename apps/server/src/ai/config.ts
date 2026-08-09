export const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.5-flash-lite";

export type AiProviderConfig =
  | { kind: "mock"; model: string }
  | { kind: "openrouter"; model: string; apiKey: string };

export function resolveAiProviderConfig(env: NodeJS.ProcessEnv): AiProviderConfig {
  const kind = env.JOB_COPILOT_AI_PROVIDER ?? "mock";
  const model = env.JOB_COPILOT_AI_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  if (model.trim() === "" || model.length > 256) {
    throw new TypeError("JOB_COPILOT_AI_MODEL must name one model");
  }
  if (kind === "mock") return { kind, model };
  if (kind !== "openrouter") {
    throw new TypeError("JOB_COPILOT_AI_PROVIDER must be mock or openrouter");
  }
  const apiKey = env.OPENROUTER_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new TypeError("OPENROUTER_API_KEY is required for the OpenRouter provider");
  }
  return { kind, model, apiKey };
}
