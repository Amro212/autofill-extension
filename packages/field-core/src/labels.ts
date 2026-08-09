import { normalizeWhitespace } from "./normalize.js";

export interface LabelEvidence {
  adapterRule?: string;
  labelFor?: string;
  wrappingLabel?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  legend?: string;
  nearbyHeading?: string;
  placeholder?: string;
  fallback?: string;
}

export type LabelSource = keyof LabelEvidence;

const priority: LabelSource[] = [
  "adapterRule",
  "labelFor",
  "wrappingLabel",
  "ariaLabel",
  "ariaLabelledBy",
  "legend",
  "nearbyHeading",
  "placeholder",
  "fallback",
];

export function normalizeLabel(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\s*[*:]+\s*$/g, "")
    .replace(/\s*\(required\)\s*$/i, "")
    .replace(/\s*[*:]+\s*$/g, "")
    .trim();
}

export function selectBestLabel(
  evidence: LabelEvidence,
): { label: string; source: LabelSource } | undefined {
  for (const source of priority) {
    const value = evidence[source];
    if (value === undefined) continue;
    const label = normalizeLabel(value);
    if (label !== "") return { label, source };
  }
  return undefined;
}
