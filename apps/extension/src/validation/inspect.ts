import type { NormalizedFieldRegistry } from "../fields/registry.js";
import { readFieldValue } from "../fields/verify.js";

export type ValidationCode =
  | "required"
  | "type-mismatch"
  | "too-long"
  | "too-short"
  | "range-underflow"
  | "range-overflow"
  | "pattern-mismatch"
  | "aria-invalid"
  | "site-error";

export interface ValidationIssue {
  fieldId?: string;
  code: ValidationCode;
  message: string;
  severity: "warning" | "error";
}

function textForIds(document: Document, ids: string | null): string {
  if (ids === null) return "";
  return ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmpty(value: ReturnType<typeof readFieldValue>): boolean {
  return value === "" || value === false || (Array.isArray(value) && value.length === 0);
}

function validityCode(validity: ValidityState): ValidationCode | undefined {
  if (validity.valueMissing) return "required";
  if (validity.typeMismatch) return "type-mismatch";
  if (validity.tooLong) return "too-long";
  if (validity.tooShort) return "too-short";
  if (validity.rangeUnderflow) return "range-underflow";
  if (validity.rangeOverflow) return "range-overflow";
  if (validity.patternMismatch) return "pattern-mismatch";
  return undefined;
}

export function inspectValidation(
  document: Document,
  registry: NormalizedFieldRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const add = (issue: ValidationIssue) => {
    const key = `${issue.fieldId ?? "page"}|${issue.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  };
  for (const field of registry.list()) {
    const discovered = registry.discovered(field.id);
    if (discovered === undefined) continue;
    if (field.required && isEmpty(readFieldValue(discovered))) {
      add({
        fieldId: field.id,
        code: "required",
        message: `${field.label} is required`,
        severity: "error",
      });
    }
    for (const element of discovered.elements) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        const code = validityCode(element.validity);
        if (code !== undefined) {
          add({
            fieldId: field.id,
            code,
            message: element.validationMessage || `${field.label} is invalid`,
            severity: "error",
          });
        }
      }
      if (element.getAttribute("aria-invalid") === "true") {
        const described = textForIds(
          document,
          element.getAttribute("aria-errormessage") ??
            element.getAttribute("aria-describedby"),
        );
        add({
          fieldId: field.id,
          code: "aria-invalid",
          message: described || `${field.label} is invalid`,
          severity: "error",
        });
      }
    }
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[role='alert'], .error, .field-error, [data-error]",
  )) {
    const message = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    if (message === "") continue;
    const referencedId = element.id;
    const linkedFieldIds = new Set(
      [...element.querySelectorAll<HTMLAnchorElement>("a[href^='#']")].flatMap((anchor) => {
        const target = anchor.getAttribute("href")?.slice(1);
        if (target === undefined || target === "") return [];
        try {
          return [decodeURIComponent(target)];
        } catch {
          return [target];
        }
      }),
    );
    const field = registry.list().find((candidate) =>
      registry
        .elements(candidate.id)
        .some((control) =>
          linkedFieldIds.has(control.id) ||
          (control.getAttribute("aria-describedby") ?? "")
            .split(/\s+/)
            .includes(referencedId),
        ),
    );
    add({
      ...(field === undefined ? {} : { fieldId: field.id }),
      code: "site-error",
      message,
      severity: "error",
    });
  }
  return issues;
}
