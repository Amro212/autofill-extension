import type { DiscoveredField } from "./discover.js";
import type { FieldValue } from "./verify.js";

export interface UndoSnapshot {
  discovered: DiscoveredField;
  value: FieldValue;
}

export function captureUndo(discovered: DiscoveredField, value: FieldValue): UndoSnapshot {
  return { discovered, value: Array.isArray(value) ? [...value] : value };
}
