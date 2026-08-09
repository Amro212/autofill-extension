export type ProviderTask = "answer-page" | "repair-json" | "rewrite-field";

export interface ProviderPrompt {
  task: ProviderTask;
  system: string;
  user: string;
  responseSchemaName: "page-answers" | "rewrite-result";
}

export interface LlmProvider {
  complete(prompt: ProviderPrompt): Promise<string>;
}
