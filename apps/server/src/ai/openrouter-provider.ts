import type {
  LlmProvider,
  ProviderPrompt,
} from "@job-copilot/ai-core";

export interface OpenRouterProviderOptions {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
  endpoint?: string;
}

const answerValueSchema = {
  anyOf: [
    { type: "string", maxLength: 20_000 },
    { type: "number" },
    { type: "boolean" },
    {
      type: "array",
      maxItems: 50,
      items: { type: "string", maxLength: 2_000 },
    },
  ],
};

const pageAnswersSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answers: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldId: { type: "string", minLength: 1, maxLength: 256 },
          value: answerValueSchema,
          confidence: { type: "number", minimum: 0, maximum: 1 },
          inferred: { type: "boolean" },
          rationaleCode: { type: "string", minLength: 1, maxLength: 128 },
        },
        required: [
          "fieldId",
          "value",
          "confidence",
          "inferred",
          "rationaleCode",
        ],
      },
    },
  },
  required: ["answers"],
};

const rewriteResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fieldId: { type: "string", minLength: 1, maxLength: 256 },
    value: { type: "string", maxLength: 20_000 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["fieldId", "value", "confidence"],
};

const generatedFactSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string", minLength: 1, maxLength: 20_000 },
    sourceFactIds: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
  },
  required: ["text", "sourceFactIds"],
};

const tailoredResumeOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceDocumentId: { type: "string", minLength: 1 },
    promptVersion: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    summary: generatedFactSchema,
    sections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: ["header", "summary", "employment", "education", "projects", "skills", "certifications", "other"],
          },
          heading: { type: "string", minLength: 1 },
          bullets: { type: "array", minItems: 1, items: generatedFactSchema },
        },
        required: ["kind", "heading", "bullets"],
      },
    },
  },
  required: ["sourceDocumentId", "promptVersion", "sections"],
};

const coverLetterOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    promptVersion: { type: "string", minLength: 1 },
    recipient: { type: "string", minLength: 1 },
    subject: { type: "string", minLength: 1 },
    paragraphs: { type: "array", minItems: 1, items: generatedFactSchema },
  },
  required: ["promptVersion", "paragraphs"],
};

function responseSchema(prompt: ProviderPrompt) {
  if (prompt.responseSchemaName === "page-answers") {
    return { name: "page_answers", schema: pageAnswersSchema };
  }
  if (prompt.responseSchemaName === "rewrite-result") {
    return { name: "rewrite_result", schema: rewriteResultSchema };
  }
  if (prompt.responseSchemaName === "tailored-resume") {
    return { name: "tailored_resume", schema: tailoredResumeOutputSchema };
  }
  return { name: "cover_letter", schema: coverLetterOutputSchema };
}

function responseContent(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("choices" in value)) {
    return undefined;
  }
  const choices = value.choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  if (typeof first !== "object" || first === null || !("message" in first)) {
    return undefined;
  }
  const message = first.message;
  return typeof message === "object" &&
    message !== null &&
    "content" in message &&
    typeof message.content === "string"
    ? message.content
    : undefined;
}

export class OpenRouterProvider implements LlmProvider {
  readonly #fetcher: typeof fetch;
  readonly #endpoint: string;

  constructor(private readonly options: OpenRouterProviderOptions) {
    if (options.apiKey.trim() === "") throw new TypeError("OpenRouter API key is required");
    if (options.model.trim() === "") throw new TypeError("OpenRouter model is required");
    this.#fetcher = options.fetcher ?? fetch;
    this.#endpoint =
      options.endpoint ?? "https://openrouter.ai/api/v1/chat/completions";
  }

  async complete(prompt: ProviderPrompt): Promise<string> {
    const format = responseSchema(prompt);
    const response = await this.#fetcher(this.#endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.1,
        max_completion_tokens: 4_000,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: { name: format.name, strict: true, schema: format.schema },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter request failed (${response.status})`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("OpenRouter returned an invalid response");
    }
    const content = responseContent(body);
    if (content === undefined) {
      throw new Error("OpenRouter returned an invalid response");
    }
    return content;
  }
}
