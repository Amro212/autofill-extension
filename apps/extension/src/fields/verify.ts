import { normalizeForMatch } from "@job-copilot/field-core";

import type { DiscoveredField } from "./discover.js";

export type FieldValue = string | boolean | string[];

export function readFieldValue(discovered: DiscoveredField): FieldValue {
  const [element] = discovered.elements;
  if (element === undefined) return "";
  if (discovered.field.kind === "radio-group") {
    return (
      (discovered.elements as HTMLInputElement[]).find((input) => input.checked)
        ?.value ?? ""
    );
  }
  if (discovered.field.kind === "checkbox-group") {
    return (discovered.elements as HTMLInputElement[])
      .filter((input) => input.checked)
      .map((input) => input.value);
  }
  if (element instanceof HTMLInputElement) {
    return element.type === "checkbox" ? element.checked : element.value;
  }
  if (element instanceof HTMLSelectElement) {
    return element.multiple
      ? [...element.selectedOptions].map((option) => option.value)
      : element.value;
  }
  if (element instanceof HTMLTextAreaElement) return element.value;
  if (
    discovered.field.kind === "combobox" ||
    discovered.field.kind === "autocomplete"
  ) {
    return (
      element.getAttribute("aria-valuetext") ??
      ("value" in element && typeof element.value === "string"
        ? element.value
        : element.textContent ?? "")
    );
  }
  return element.textContent ?? "";
}

function valuesMatch(actual: FieldValue, expected: FieldValue): boolean {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      expected.every((value) => actual.includes(value))
    );
  }
  if (typeof actual === "string" && typeof expected === "string") {
    return normalizeForMatch(actual) === normalizeForMatch(expected);
  }
  return actual === expected;
}

export async function verifyFieldValue(
  discovered: DiscoveredField,
  expected: FieldValue,
  timeoutMs = 300,
): Promise<FieldValue | undefined> {
  const deadline = Date.now() + timeoutMs;
  do {
    const actual = readFieldValue(discovered);
    if (valuesMatch(actual, expected)) return actual;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  } while (Date.now() <= deadline);
  return undefined;
}
