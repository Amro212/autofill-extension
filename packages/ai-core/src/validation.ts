import {
  pageAnswerResultSchema,
  rewriteResultSchema,
  type NormalizedField,
  type PageAnswerResult,
  type RewriteResult,
} from "@job-copilot/contracts";

function fail(code: string): never {
  throw new TypeError(code);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fail("invalid-json");
  }
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function optionValue(field: NormalizedField, requested: string): string | undefined {
  const needle = normalize(requested);
  return field.options
    ?.filter((option) => option.disabled !== true)
    .find(
      (option) =>
        normalize(option.label) === needle ||
        (option.value !== undefined && normalize(option.value) === needle),
    )?.value ??
    field.options
      ?.filter((option) => option.disabled !== true)
      .find((option) => normalize(option.label) === needle)?.label;
}

function validText(field: NormalizedField, value: string): boolean {
  const length = value.length;
  if (field.constraints?.maxLength !== undefined && length > field.constraints.maxLength) {
    return false;
  }
  if (field.constraints?.minLength !== undefined && length < field.constraints.minLength) {
    return false;
  }
  if (field.constraints?.pattern !== undefined) {
    try {
      if (!new RegExp(field.constraints.pattern).test(value)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function validateValue(field: NormalizedField, value: unknown): void {
  if (field.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) fail("invalid-field-value");
    if (field.constraints?.min !== undefined && value < field.constraints.min) {
      fail("invalid-field-value");
    }
    if (field.constraints?.max !== undefined && value > field.constraints.max) {
      fail("invalid-field-value");
    }
    return;
  }
  if (field.kind === "checkbox") {
    if (typeof value !== "boolean") fail("invalid-field-value");
    return;
  }
  if (field.kind === "checkbox-group" || field.kind === "multi-select") {
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
      fail("invalid-field-value");
    }
    if (value.some((entry) => optionValue(field, entry) === undefined)) {
      fail("invalid-option");
    }
    return;
  }
  if (
    field.kind === "native-select" ||
    field.kind === "radio-group" ||
    field.kind === "combobox" ||
    field.kind === "autocomplete"
  ) {
    if (typeof value !== "string") fail("invalid-field-value");
    if (optionValue(field, value) === undefined) fail("invalid-option");
    return;
  }
  if (field.kind === "date") {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ) {
      fail("invalid-field-value");
    }
    return;
  }
  if (field.kind === "file") fail("invalid-field-value");
  if (typeof value !== "string" || !validText(field, value)) {
    fail("invalid-field-value");
  }
}

export function parseAndValidatePageAnswers(
  raw: string,
  fields: NormalizedField[],
): PageAnswerResult {
  const parsed = pageAnswerResultSchema.parse(parseJson(raw));
  const byId = new Map(fields.map((field) => [field.id, field]));
  for (const answer of parsed.answers) {
    const field = byId.get(answer.fieldId);
    if (field === undefined) fail("unknown-field");
    validateValue(field, answer.value);
  }
  return parsed;
}

export function parseAndValidateRewrite(
  raw: string,
  field: NormalizedField,
): RewriteResult {
  const parsed = rewriteResultSchema.parse(parseJson(raw));
  if (parsed.fieldId !== field.id) fail("unknown-field");
  validateValue(field, parsed.value);
  return parsed;
}
