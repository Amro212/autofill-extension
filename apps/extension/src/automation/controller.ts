import type {
  ApplicationState,
  AutomationSettingsUpdate,
} from "@job-copilot/contracts";

import { classifyBoundary, waitForCaptchaClear } from "../boundaries/classify.js";
import type { FillPageInput, FillPageResult } from "../fill/controller.js";
import type { NavigationResult } from "../navigation/controller.js";
import type { PageClassification } from "../page-classifier/index.js";
import type { ValidationIssue } from "../validation/inspect.js";

interface RepairResult {
  repaired: boolean;
  issues: ValidationIssue[];
}

export interface PageAutomationOptions {
  transition: (state: ApplicationState) => Promise<ApplicationState>;
  fillPage: (input: FillPageInput) => Promise<FillPageResult>;
  uploadDocuments: () => Promise<{ uploaded: number; failed: number }>;
  inspectValidation: () => ValidationIssue[];
  repairPage: () => Promise<RepairResult>;
  advance: (
    document: Document,
    settings: {
      autoContinue: boolean;
      autoSubmit: boolean;
      pageType: PageClassification["type"];
    },
  ) => Promise<NavigationResult>;
  waitForCaptchaClear?: typeof waitForCaptchaClear;
}

export interface PageAutomationInput {
  applicationId?: string;
  pageKey: string;
  state: ApplicationState;
  classification: PageClassification;
  settings: Pick<AutomationSettingsUpdate, "autoContinue" | "autoSubmit"> & {
    autoContinue: boolean;
    autoSubmit: boolean;
  };
}

export type PageAutomationResult =
  | { status: "navigated" | "submitted" | "review-required" | "paused" }
  | { status: "captcha-cleared" | "captcha-timeout" }
  | { status: "user-boundary"; reason: string }
  | { status: "validation-failed"; issues: ValidationIssue[] }
  | { status: "upload-failed" }
  | { status: "failed" }
  | { status: "navigation-failed" };

export class PageAutomationController {
  constructor(private readonly options: PageAutomationOptions) {}

  async run(document: Document, input: PageAutomationInput): Promise<PageAutomationResult> {
    let state = input.state;
    const move = async (next: ApplicationState) => {
      if (state === next) return;
      state = await this.options.transition(next);
    };

    if (state === "DISCOVERED" || state === "JOB_CONTEXT_CAPTURED") {
      await move("APPLICATION_LINKED");
    }
    if (state === "APPLICATION_LINKED" || state === "WAITING_FOR_USER_START") {
      await move("SCANNING");
    }

    const boundary = classifyBoundary(document);
    if (boundary.type === "captcha" || input.classification.type === "captcha") {
      await move("AWAITING_CAPTCHA");
      const cleared = await (this.options.waitForCaptchaClear ?? waitForCaptchaClear)(document);
      if (cleared) {
        await move("SCANNING");
        return { status: "captcha-cleared" };
      }
      await move("PAUSED");
      return { status: "captcha-timeout" };
    }
    if (boundary.type !== "none" || input.classification.type === "boundary") {
      await move("USER_BOUNDARY");
      return { status: "user-boundary", reason: boundary.reason ?? "User action is required" };
    }

    if (state === "READY_TO_SUBMIT" && input.classification.type === "review") {
      const issues = this.options.inspectValidation();
      if (issues.some(({ severity }) => severity === "error")) {
        await move("PAUSED");
        await move("SCANNING");
      } else if (!input.settings.autoSubmit || input.classification.confidence < 0.9) {
        return { status: "review-required" };
      } else {
        await move("SUBMITTING");
        const navigation = await this.options.advance(document, {
          ...input.settings,
          pageType: input.classification.type,
        });
        if (navigation.status === "submitted") {
          await move("SUBMITTED");
          return { status: "submitted" };
        }
        await move("FAILED");
        return { status: "navigation-failed" };
      }
    }

    if (
      state === "USER_BOUNDARY" ||
      state === "AWAITING_CAPTCHA" ||
      state === "PAUSED" ||
      state === "FAILED" ||
      state === "NAVIGATING"
    ) {
      await move("SCANNING");
    }

    if (state !== "SCANNING") return { status: "paused" };
    await move("GENERATING");
    try {
      await this.options.fillPage({
        pageKey: input.pageKey,
        ...(input.applicationId === undefined ? {} : { applicationId: input.applicationId }),
      });
    } catch {
      await move("FAILED");
      return { status: "failed" };
    }
    await move("FILLING");
    const uploads = await this.options.uploadDocuments();
    if (uploads.failed > 0) {
      await move("FAILED");
      return { status: "upload-failed" };
    }
    await move("VERIFYING_FIELDS");
    await move("VALIDATING_PAGE");

    let issues = this.options.inspectValidation();
    if (issues.some(({ severity }) => severity === "error")) {
      await move("REPAIRING");
      const repair = await this.options.repairPage();
      await move("VALIDATING_PAGE");
      issues = repair.issues;
    }
    if (issues.some(({ severity }) => severity === "error")) {
      await move("FAILED");
      return { status: "validation-failed", issues };
    }

    const finalPage = input.classification.type === "review";
    await move(finalPage ? "READY_TO_SUBMIT" : "READY_TO_CONTINUE");
    if (finalPage && (!input.settings.autoSubmit || input.classification.confidence < 0.9)) {
      return { status: "review-required" };
    }
    if (!finalPage && !input.settings.autoContinue) return { status: "paused" };

    await move(finalPage ? "SUBMITTING" : "NAVIGATING");
    const navigation = await this.options.advance(document, {
      ...input.settings,
      pageType: input.classification.type,
    });
    if (navigation.status === "submitted") {
      await move("SUBMITTED");
      return { status: "submitted" };
    }
    if (navigation.status === "navigated") {
      await move("SCANNING");
      return { status: "navigated" };
    }
    await move("FAILED");
    return { status: "navigation-failed" };
  }
}
