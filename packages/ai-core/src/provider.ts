export type ProviderTask =
  | "answer-page"
  | "repair-json"
  | "rewrite-field"
  | "tailor-resume"
  | "generate-cover-letter";

export interface ProviderPrompt {
  task: ProviderTask;
  system: string;
  user: string;
  responseSchemaName:
    | "page-answers"
    | "rewrite-result"
    | "tailored-resume"
    | "cover-letter";
}

export interface LlmProvider {
  complete(prompt: ProviderPrompt): Promise<string>;
}
