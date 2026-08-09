import { z } from "zod";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every(isJsonValue);
}

export const jsonValueSchema = z.custom<JsonValue>(isJsonValue, {
  message: "Expected a JSON-serializable value",
});

export const fieldKindSchema = z.enum([
  "text",
  "textarea",
  "email",
  "tel",
  "url",
  "number",
  "date",
  "native-select",
  "radio-group",
  "checkbox",
  "checkbox-group",
  "combobox",
  "autocomplete",
  "multi-select",
  "contenteditable",
  "rich-text",
  "file",
  "custom",
]);

export const normalizedFieldSchema = z.object({
  id: z.string().min(1),
  adapterId: z.string().min(1),
  pageKey: z.string().min(1),
  kind: fieldKindSchema,
  semanticType: z.string().min(1).optional(),
  label: z.string(),
  description: z.string().optional(),
  section: z.string().optional(),
  required: z.boolean(),
  currentValue: jsonValueSchema,
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string().optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  constraints: z
    .object({
      maxLength: z.number().int().nonnegative().optional(),
      minLength: z.number().int().nonnegative().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      acceptedFileTypes: z.array(z.string()).optional(),
    })
    .optional(),
  evidence: z.object({
    labelFor: z.boolean().optional(),
    wrappingLabel: z.boolean().optional(),
    ariaLabel: z.boolean().optional(),
    ariaLabelledBy: z.boolean().optional(),
    ariaDescribedBy: z.boolean().optional(),
    legend: z.boolean().optional(),
    nearbyHeading: z.boolean().optional(),
    placeholder: z.boolean().optional(),
    adapterRule: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1),
});

export type FieldKind = z.infer<typeof fieldKindSchema>;
export type NormalizedField = z.infer<typeof normalizedFieldSchema>;
