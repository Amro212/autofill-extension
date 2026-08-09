import {
  buildPageAnswerPrompt,
  buildRepairPrompt,
  buildRewritePrompt,
  parseAndValidatePageAnswers,
  parseAndValidateRewrite,
  type LlmProvider,
  type PagePromptContext,
  type ProviderPrompt,
} from "@job-copilot/ai-core";
import {
  pageAnswerRequestSchema,
  rewriteRequestSchema,
  type PageAnswerRequest,
  type PageAnswerResult,
  type RewriteRequest,
  type RewriteResult,
} from "@job-copilot/contracts";

export interface AiServiceOptions {
  maxRepairAttempts?: number;
}

export class AiService {
  readonly #maxRepairAttempts: number;

  constructor(
    private readonly provider: LlmProvider,
    options: AiServiceOptions = {},
  ) {
    this.#maxRepairAttempts = options.maxRepairAttempts ?? 1;
    if (
      !Number.isInteger(this.#maxRepairAttempts) ||
      this.#maxRepairAttempts < 0 ||
      this.#maxRepairAttempts > 2
    ) {
      throw new TypeError("maxRepairAttempts must be between 0 and 2");
    }
  }

  async #completeValidated<T>(
    prompt: ProviderPrompt,
    validate: (raw: string) => T,
  ): Promise<T> {
    let activePrompt = prompt;
    let raw = "";
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.#maxRepairAttempts; attempt++) {
      raw = await this.provider.complete(activePrompt);
      try {
        return validate(raw);
      } catch (error) {
        lastError = error;
        if (attempt === this.#maxRepairAttempts) break;
        activePrompt = buildRepairPrompt(
          prompt,
          raw,
          error instanceof Error ? error.message : "invalid-output",
        );
      }
    }
    throw lastError instanceof Error ? lastError : new TypeError("invalid-output");
  }

  async answerPage(
    input: PageAnswerRequest,
    context: Omit<PagePromptContext, "fields">,
  ): Promise<PageAnswerResult> {
    const request = pageAnswerRequestSchema.parse(input);
    const prompt = buildPageAnswerPrompt({ ...context, fields: request.fields });
    return this.#completeValidated(prompt, (raw) =>
      parseAndValidatePageAnswers(raw, request.fields),
    );
  }

  async rewriteField(
    input: RewriteRequest,
    context: Omit<PagePromptContext, "fields">,
  ): Promise<RewriteResult> {
    const request = rewriteRequestSchema.parse(input);
    const prompt = buildRewritePrompt(request, context);
    return this.#completeValidated(prompt, (raw) =>
      parseAndValidateRewrite(raw, request.field),
    );
  }
}
