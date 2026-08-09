import type { FieldKind } from "@job-copilot/contracts";

import { normalizeForMatch } from "./normalize.js";

export interface FieldSignatureInput {
  pageKey: string;
  kind: FieldKind;
  label: string;
  section?: string;
  ordinal: number;
}

export function createFieldSignature(input: FieldSignatureInput): string {
  const canonical = [
    input.pageKey,
    input.kind,
    normalizeForMatch(input.label),
    normalizeForMatch(input.section ?? ""),
    String(input.ordinal),
  ].join("|");
  let hash = 2_166_136_261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `field-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

