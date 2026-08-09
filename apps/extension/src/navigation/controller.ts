import type { PageType } from "../page-classifier/index.js";
import { classifyBoundary } from "../boundaries/classify.js";
import type { ValidationIssue } from "../validation/inspect.js";
import { classifyNavigation } from "./classify.js";

export type NavigationResult =
  | { status: "validation-blocked"; issues: ValidationIssue[] }
  | { status: "review-required" }
  | { status: "paused" }
  | { status: "captcha" }
  | { status: "user-boundary"; reason: string }
  | { status: "control-not-found" }
  | { status: "navigation-failed"; attempts: number }
  | { status: "navigated"; attempts: number }
  | { status: "submitted"; attempts: number };

export interface NavigationControllerOptions {
  inspectValidation: () => ValidationIssue[];
  waitForTransition: () => Promise<boolean>;
  maxAttempts?: number;
}

export class NavigationController {
  readonly #maxAttempts: number;

  constructor(private readonly options: NavigationControllerOptions) {
    this.#maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isInteger(this.#maxAttempts) || this.#maxAttempts < 1 || this.#maxAttempts > 3) {
      throw new TypeError("maxAttempts must be between 1 and 3");
    }
  }

  async advance(
    document: Document,
    settings: {
      autoContinue: boolean;
      autoSubmit: boolean;
      pageType: PageType;
    },
  ): Promise<NavigationResult> {
    const boundary = classifyBoundary(document);
    if (boundary.type === "captcha" || settings.pageType === "captcha") {
      return { status: "captcha" };
    }
    if (boundary.type !== "none" || settings.pageType === "boundary") {
      return {
        status: "user-boundary",
        reason: boundary.reason ?? "User action is required",
      };
    }
    const issues = this.options.inspectValidation();
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "validation-blocked", issues };
    }
    const targets = classifyNavigation(document);
    const isFinal = settings.pageType === "review";
    if (isFinal && !settings.autoSubmit) return { status: "review-required" };
    if (!isFinal && !settings.autoContinue) return { status: "paused" };
    const target = isFinal
      ? targets.find(({ kind }) => kind === "submit")
      : targets.find(({ kind }) => kind === "continue" || kind === "review");
    if (target === undefined) return { status: "control-not-found" };
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
      target.element.click();
      if (await this.options.waitForTransition()) {
        return {
          status: isFinal ? "submitted" : "navigated",
          attempts: attempt,
        };
      }
    }
    return { status: "navigation-failed", attempts: this.#maxAttempts };
  }
}
