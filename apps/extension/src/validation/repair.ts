import type { PageAnswerRequest, PageAnswerResult } from "@job-copilot/contracts";

import { executeField } from "../fields/execute.js";
import type { ExecutionResult } from "../fields/execute.js";
import type { DiscoveredField } from "../fields/discover.js";
import type { NormalizedFieldRegistry } from "../fields/registry.js";
import { readFieldValue, type FieldValue } from "../fields/verify.js";
import { inspectValidation, type ValidationIssue } from "./inspect.js";

export interface LocalRepairResult {
  repaired: boolean;
  value?: FieldValue;
  reason?: "field-not-found" | "no-safe-local-repair" | "verification-failed";
}

export async function repairLocally(
  issue: ValidationIssue,
  registry: NormalizedFieldRegistry,
): Promise<LocalRepairResult> {
  if (issue.fieldId === undefined) return { repaired: false, reason: "field-not-found" };
  const discovered = registry.discovered(issue.fieldId);
  if (discovered === undefined) return { repaired: false, reason: "field-not-found" };
  const [element] = discovered.elements;
  const current = readFieldValue(discovered);
  let replacement: FieldValue | undefined;
  if (
    issue.code === "too-long" &&
    typeof current === "string" &&
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
  ) {
    const maxLength =
      element.maxLength >= 0
        ? element.maxLength
        : discovered.field.constraints?.maxLength;
    if (maxLength !== undefined && maxLength >= 0) {
      replacement = current.slice(0, maxLength);
    }
  } else if (
    (issue.code === "range-underflow" || issue.code === "range-overflow") &&
    element instanceof HTMLInputElement &&
    element.type === "number"
  ) {
    const boundary = issue.code === "range-underflow" ? element.min : element.max;
    if (boundary !== "" && Number.isFinite(Number(boundary))) replacement = boundary;
  }
  if (replacement === undefined) {
    return { repaired: false, reason: "no-safe-local-repair" };
  }
  const execution = await executeField(discovered, replacement);
  return execution.ok
    ? { repaired: true, value: execution.actualValue }
    : { repaired: false, reason: "verification-failed" };
}

export interface ValidationRepairOptions {
  registry: NormalizedFieldRegistry;
  answerPage: (request: PageAnswerRequest) => Promise<PageAnswerResult>;
  execute?: (field: DiscoveredField, value: FieldValue) => Promise<ExecutionResult>;
  maxAiAttempts?: number;
}

export interface PageRepairResult {
  repaired: boolean;
  localAttempts: number;
  aiAttempts: number;
  issues: ValidationIssue[];
}

export class ValidationRepairController {
  readonly #registry: NormalizedFieldRegistry;
  readonly #answerPage: ValidationRepairOptions["answerPage"];
  readonly #maxAiAttempts: number;
  readonly #execute: NonNullable<ValidationRepairOptions["execute"]>;

  constructor(options: ValidationRepairOptions) {
    this.#registry = options.registry;
    this.#answerPage = options.answerPage;
    this.#execute = options.execute ?? executeField;
    this.#maxAiAttempts = Math.max(0, Math.min(2, options.maxAiAttempts ?? 2));
  }

  async repairPage(
    document: Document,
    request: Pick<PageAnswerRequest, "applicationId" | "pageKey">,
  ): Promise<PageRepairResult> {
    let issues = inspectValidation(document, this.#registry);
    let localAttempts = 0;
    let aiAttempts = 0;

    for (const issue of issues) {
      if (issue.fieldId === undefined) continue;
      localAttempts += 1;
      await repairLocally(issue, this.#registry);
    }
    issues = inspectValidation(document, this.#registry);

    while (issues.some(({ severity }) => severity === "error") && aiAttempts < this.#maxAiAttempts) {
      const fieldIds = new Set(
        issues.flatMap(({ fieldId }) => (fieldId === undefined ? [] : [fieldId])),
      );
      const fields = [...fieldIds]
        .map((fieldId) => this.#registry.get(fieldId))
        .filter((field) => field !== undefined);
      if (fields.length === 0) break;

      aiAttempts += 1;
      const result = await this.#answerPage({ ...request, fields });
      for (const answer of result.answers) {
        if (!fieldIds.has(answer.fieldId)) continue;
        const discovered = this.#registry.discovered(answer.fieldId);
        if (discovered !== undefined) {
          await this.#execute(
            discovered,
            typeof answer.value === "number" ? String(answer.value) : answer.value,
          );
        }
      }
      issues = inspectValidation(document, this.#registry);
    }

    return {
      repaired: !issues.some(({ severity }) => severity === "error"),
      localAttempts,
      aiAttempts,
      issues,
    };
  }
}
