import type { AtsAdapter, AtsPageKind } from "./types.js";

function text(element: HTMLElement): string {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function genericPageKind(document: Document): AtsPageKind {
  if (document.querySelector("form input, form textarea, form select") !== null) {
    return "application";
  }
  if (document.querySelector("[itemtype*='JobPosting'], script[type='application/ld+json']")) {
    return "listing";
  }
  return "unknown";
}

const genericAdapter: AtsAdapter = {
  id: "generic",
  matches: () => true,
  pageKind: genericPageKind,
  isFinalPage: () => false,
  shouldIgnore: () => false,
  navigationKind: () => undefined,
};

const workdayAdapter: AtsAdapter = {
  id: "workday",
  matches: (url, document) =>
    /(?:^|\.)myworkdayjobs\.com$/i.test(url.hostname) ||
    document.querySelector("[data-automation-id='applyFlowPage']") !== null,
  pageKind: (document) => {
    if (document.querySelector("[data-automation-id='applyFlowPage']")) return "application";
    if (
      document.querySelector(
        "[data-automation-id='jobPostingHeader'], [data-automation-id='jobTitleHeading']",
      )
    ) {
      return "listing";
    }
    return genericPageKind(document);
  },
  isFinalPage: (document) =>
    document.querySelector(
      "[data-automation-id*='review'], [data-automation-id*='submit']",
    ) !== null && /review (?:your|my) application/i.test(document.body?.textContent ?? ""),
  shouldIgnore: (element) =>
    element.matches("[data-automation-id='beecatcher'], input[type='password']") ||
    element.closest("[data-automation-id='signInFormo']") !== null,
  navigationKind: (element) => {
    const id = element.getAttribute("data-automation-id") ?? "";
    if (/bottom-navigation-next-button|continueButton/i.test(id)) return "continue";
    if (/review/i.test(id)) return "review";
    if (/submit/i.test(id) && element.matches("button, [role='button'], input[type='submit']")) {
      return "submit";
    }
    return undefined;
  },
};

const greenhouseAdapter: AtsAdapter = {
  id: "greenhouse",
  matches: (url, document) =>
    /(?:^|\.)greenhouse\.io$/i.test(url.hostname) ||
    document.querySelector("#application-form, input#resume, [data-testid='resume-text']") !== null,
  pageKind: (document) =>
    document.querySelector("#application-form, form input#resume") !== null
      ? "application"
      : genericPageKind(document),
  isFinalPage: (document) =>
    document.querySelector(
      "#application-form button[type='submit'], form button[type='submit']",
    ) !== null,
  shouldIgnore: (element) =>
    element instanceof HTMLInputElement &&
    element.id === "" &&
    element.name === "" &&
    element.getAttribute("aria-label") === null &&
    element.getAttribute("role") === null &&
    element.type !== "file",
  navigationKind: (element) =>
    element.matches("#application-form button[type='submit'], form button[type='submit']") &&
    /submit application|submit/i.test(text(element))
      ? "submit"
      : undefined,
};

const adapters: AtsAdapter[] = [workdayAdapter, greenhouseAdapter];

export function detectAtsAdapter(url: URL, document: Document): AtsAdapter {
  return adapters.find((adapter) => adapter.matches(url, document)) ?? genericAdapter;
}

export function activeAtsAdapter(document: Document): AtsAdapter {
  let url: URL;
  try {
    url = new URL(document.location.href);
  } catch {
    url = new URL("https://invalid.local/");
  }
  return detectAtsAdapter(url, document);
}
