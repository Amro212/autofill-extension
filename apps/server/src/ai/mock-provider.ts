import type {
  LlmProvider,
  ProviderPrompt,
} from "@job-copilot/ai-core";
import type {
  AiAnswerValue,
  NormalizedField,
} from "@job-copilot/contracts";

function readSection<T>(prompt: string, name: string): T {
  const start = `<${name}>\n`;
  const end = `\n</${name}>`;
  const from = prompt.indexOf(start);
  const to = prompt.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new TypeError(`Missing prompt section ${name}`);
  return JSON.parse(prompt.slice(from + start.length, to)) as T;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function path(value: unknown, ...parts: string[]): unknown {
  let current = value;
  for (const part of parts) current = record(current)[part];
  return current;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function option(field: NormalizedField, requested: unknown): string | undefined {
  if (typeof requested !== "string") return undefined;
  const match = field.options?.find(
    (candidate) =>
      candidate.disabled !== true &&
      (normalized(candidate.label) === normalized(requested) ||
        (candidate.value !== undefined &&
          normalized(candidate.value) === normalized(requested))),
  );
  return match?.value ?? match?.label;
}

function profileValue(field: NormalizedField, profile: unknown): unknown {
  const label = normalized(field.label);
  if (label.includes("first") && label.includes("name")) {
    return path(profile, "identity", "firstName");
  }
  if (label.includes("last") && label.includes("name")) {
    return path(profile, "identity", "lastName");
  }
  if (label.includes("email")) return path(profile, "contact", "email");
  if (label.includes("phone")) return path(profile, "contact", "phone");
  if (label.includes("country")) return path(profile, "contact", "country");
  if (label.includes("city")) return path(profile, "contact", "city");
  if (field.semanticType !== undefined) {
    const [scope, key] = field.semanticType.split(".");
    if (scope !== undefined && key !== undefined) return path(profile, scope, key);
  }
  return undefined;
}

function answer(field: NormalizedField, profile: unknown): AiAnswerValue | undefined {
  const explicit = profileValue(field, profile);
  if (
    field.kind === "native-select" ||
    field.kind === "radio-group" ||
    field.kind === "combobox" ||
    field.kind === "autocomplete"
  ) {
    const fallback = field.options?.find((item) => !item.disabled);
    return option(field, explicit) ?? fallback?.value ?? fallback?.label;
  }
  if (field.kind === "checkbox") return typeof explicit === "boolean" ? explicit : false;
  if (field.kind === "checkbox-group" || field.kind === "multi-select") return [];
  if (field.kind === "number") {
    return typeof explicit === "number" ? explicit : field.constraints?.min ?? 0;
  }
  if (field.kind === "file") return undefined;
  if (field.kind === "date") {
    const startDate = path(profile, "preferences", "startDate");
    return typeof startDate === "string" ? startDate : "2026-01-01";
  }
  if (typeof explicit === "string") return explicit;
  return `Test answer for ${field.label}`;
}

export class MockProvider implements LlmProvider {
  async complete(prompt: ProviderPrompt): Promise<string> {
    if (prompt.task === "repair-json") {
      throw new TypeError("MockProvider does not emit malformed output");
    }
    if (prompt.task === "rewrite-field") {
      const field = readSection<NormalizedField>(prompt.user, "FIELD_CONTENT");
      const current = readSection<string>(prompt.user, "CURRENT_ANSWER");
      return JSON.stringify({
        fieldId: field.id,
        value: `${current.trim()} (rewritten)`,
        confidence: 1,
      });
    }
    const facts = readSection<{ profile?: unknown }>(prompt.user, "APPLICANT_FACTS");
    const fields = readSection<NormalizedField[]>(prompt.user, "FIELD_CONTENT");
    return JSON.stringify({
      answers: fields.flatMap((field) => {
        const value = answer(field, facts.profile);
        return value === undefined
          ? []
          : [
              {
                fieldId: field.id,
                value,
                confidence: 1,
                inferred: profileValue(field, facts.profile) === undefined,
                rationaleCode: "deterministic-mock",
              },
            ];
      }),
    });
  }
}
