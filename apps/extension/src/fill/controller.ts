import type {
  AiAnswerValue,
  PageAnswerRequest,
  PageAnswerResult,
  RewriteRequest,
  RewriteResult,
} from "@job-copilot/contracts";

import {
  executeField,
  type ExecutionResult,
} from "../fields/execute.js";
import type { NormalizedFieldRegistry } from "../fields/registry.js";
import type { FieldValue } from "../fields/verify.js";

export interface FillClient {
  answerPage(input: PageAnswerRequest): Promise<PageAnswerResult>;
  rewriteField(input: RewriteRequest): Promise<RewriteResult>;
}

export interface FillControllerOptions {
  client: FillClient;
  registry: NormalizedFieldRegistry;
  execute?: typeof executeField;
}

export interface FillPageInput {
  pageKey: string;
  applicationId?: string;
}

export interface FillPageResult {
  filled: number;
  failed: number;
  results: Array<{ fieldId: string; result: ExecutionResult }>;
}

function executableValue(value: AiAnswerValue): FieldValue {
  return typeof value === "number" ? String(value) : value;
}

export class FillController {
  readonly #fills = new Map<string, Promise<FillPageResult>>();
  readonly #execute: typeof executeField;
  #lastUndo: (() => Promise<ExecutionResult>) | undefined;

  constructor(private readonly options: FillControllerOptions) {
    this.#execute = options.execute ?? executeField;
  }

  fillPage(input: FillPageInput): Promise<FillPageResult> {
    const cacheKey = `${input.applicationId ?? ""}\u0000${input.pageKey}`;
    const current = this.#fills.get(cacheKey);
    if (current !== undefined) return current;
    const fields = this.options.registry
      .list()
      .filter((field) => field.pageKey === input.pageKey && field.kind !== "file");
    
    if (fields.length === 0) {
      const operation = Promise.resolve({ filled: 0, failed: 0, results: [] });
      this.#fills.set(cacheKey, operation);
      return operation;
    }

    const operation = this.options.client
      .answerPage({
        ...(input.applicationId === undefined
          ? {}
          : { applicationId: input.applicationId }),
        pageKey: input.pageKey,
        fields,
      })
      .then(async (answers) => {
        const results: FillPageResult["results"] = [];
        for (const answer of answers.answers) {
          const discovered = this.options.registry.discovered(answer.fieldId);
          if (discovered === undefined || discovered.field.pageKey !== input.pageKey) {
            continue;
          }
          const execution = await this.#execute(
            discovered,
            executableValue(answer.value),
          );
          if (execution.ok) this.#lastUndo = execution.undo;
          results.push({ fieldId: answer.fieldId, result: execution });
        }
        return {
          filled: results.filter(({ result }) => result.ok).length,
          failed: results.filter(({ result }) => !result.ok).length,
          results,
        };
      })
      .catch((error: unknown) => {
        this.#fills.delete(cacheKey);
        throw error;
      });
    this.#fills.set(cacheKey, operation);
    return operation;
  }

  async rewrite(
    fieldId: string,
    input: {
      applicationId?: string;
      currentAnswer: string;
      feedback?: string;
    },
  ): Promise<ExecutionResult> {
    const discovered = this.options.registry.discovered(fieldId);
    if (discovered === undefined) throw new TypeError("Unknown field");
    const rewritten = await this.options.client.rewriteField({
      ...(input.applicationId === undefined
        ? {}
        : { applicationId: input.applicationId }),
      field: discovered.field,
      currentAnswer: input.currentAnswer,
      ...(input.feedback === undefined ? {} : { feedback: input.feedback }),
    });
    const execution = await this.#execute(discovered, rewritten.value);
    if (execution.ok) this.#lastUndo = execution.undo;
    return execution;
  }

  async undoLast(): Promise<ExecutionResult | undefined> {
    const undo = this.#lastUndo;
    this.#lastUndo = undefined;
    return undo?.();
  }

  invalidate(pageKey: string, applicationId?: string): void {
    this.#fills.delete(`${applicationId ?? ""}\u0000${pageKey}`);
  }
}
