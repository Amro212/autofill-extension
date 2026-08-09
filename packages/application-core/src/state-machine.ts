import type { ApplicationState } from "@job-copilot/contracts";

const transitions: Record<ApplicationState, readonly ApplicationState[]> = {
  DISCOVERED: ["JOB_CONTEXT_CAPTURED", "APPLICATION_LINKED"],
  JOB_CONTEXT_CAPTURED: ["APPLICATION_LINKED"],
  APPLICATION_LINKED: ["WAITING_FOR_USER_START", "SCANNING", "PAUSED"],
  WAITING_FOR_USER_START: ["SCANNING", "PAUSED"],
  SCANNING: [
    "GENERATING",
    "AWAITING_CAPTCHA",
    "USER_BOUNDARY",
    "FAILED",
    "PAUSED",
  ],
  GENERATING: ["FILLING", "FAILED", "PAUSED"],
  FILLING: ["VERIFYING_FIELDS", "FAILED", "PAUSED"],
  VERIFYING_FIELDS: ["REPAIRING", "VALIDATING_PAGE", "FAILED", "PAUSED"],
  REPAIRING: [
    "FILLING",
    "VERIFYING_FIELDS",
    "VALIDATING_PAGE",
    "FAILED",
    "PAUSED",
  ],
  VALIDATING_PAGE: [
    "REPAIRING",
    "READY_TO_CONTINUE",
    "READY_TO_SUBMIT",
    "AWAITING_CAPTCHA",
    "USER_BOUNDARY",
    "FAILED",
    "PAUSED",
  ],
  READY_TO_CONTINUE: ["NAVIGATING", "PAUSED"],
  NAVIGATING: [
    "SCANNING",
    "AWAITING_CAPTCHA",
    "USER_BOUNDARY",
    "READY_TO_SUBMIT",
    "FAILED",
    "PAUSED",
  ],
  AWAITING_CAPTCHA: ["SCANNING", "FAILED", "PAUSED"],
  USER_BOUNDARY: ["SCANNING", "PAUSED"],
  READY_TO_SUBMIT: ["SUBMITTING", "PAUSED"],
  SUBMITTING: ["SUBMITTED", "FAILED"],
  SUBMITTED: [],
  FAILED: ["SCANNING", "PAUSED"],
  PAUSED: ["WAITING_FOR_USER_START", "SCANNING", "READY_TO_SUBMIT"],
};

export function canTransition(
  from: ApplicationState,
  to: ApplicationState,
): boolean {
  return transitions[from].includes(to);
}

export function transitionApplication(
  from: ApplicationState,
  to: ApplicationState,
): ApplicationState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal application transition: ${from} -> ${to}`);
  }
  return to;
}
