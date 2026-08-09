import { classifyBoundary } from "../boundaries/classify.js";
import { activeAtsAdapter } from "../adapters/registry.js";

export type PageType =
  | "unrelated"
  | "job-listing"
  | "application"
  | "review"
  | "confirmation"
  | "captcha"
  | "boundary";

export interface PageClassification {
  type: PageType;
  confidence: number;
  evidence: string[];
}

function pageText(document: Document): string {
  return (document.body?.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function result(type: PageType, confidence: number, ...evidence: string[]) {
  return { type, confidence, evidence } satisfies PageClassification;
}

export function classifyPage(document: Document): PageClassification {
  const text = pageText(document);
  const adapter = activeAtsAdapter(document);
  const boundary = classifyBoundary(document);
  if (boundary.type === "captcha") {
    return result("captcha", 0.99, "captcha marker");
  }
  if (boundary.type !== "none") {
    return result("boundary", 0.98, boundary.reason ?? "user boundary language");
  }
  if (/application (?:was )?submitted|thank you for applying|application received/.test(text)) {
    return result("confirmation", 0.98, "submission confirmation language");
  }
  if (/review (?:your|my) application/.test(text) || adapter.isFinalPage(document)) {
    return result("review", 0.94, "review or final-submit marker");
  }
  if (adapter.pageKind(document) === "application") {
    return result("application", 0.94, `${adapter.id} application structure`);
  }
  const form = document.querySelector("form");
  if (
    form &&
    (/apply|application/i.test(`${document.title} ${text.slice(0, 500)}`) ||
      form.querySelector("input[type='file'], input[type='email'], [autocomplete='email']"))
  ) {
    return result("application", 0.9, "application form evidence");
  }
  const applyLink = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].some(
    (anchor) => /apply/i.test(anchor.textContent ?? "") || /apply|jobs/.test(anchor.href),
  );
  const description = document.querySelector(
    "#job-description, [data-job-description], [itemprop='description']",
  );
  if (applyLink && (description || /responsibilities|qualifications|job description/.test(text))) {
    return result("job-listing", 0.9, "job description and apply link");
  }
  if (adapter.pageKind(document) === "listing") {
    return result("job-listing", 0.92, `${adapter.id} listing structure`);
  }
  return result("unrelated", 0.8, "no job or application evidence");
}
