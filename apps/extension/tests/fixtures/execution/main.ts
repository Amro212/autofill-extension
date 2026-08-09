import type { FieldKind, NormalizedField } from "@job-copilot/contracts";

import type { DiscoveredField } from "../../../src/fields/discover.js";
import { executeField, type FieldValue } from "../../../src/fields/execute.js";

const elements = {
  name: document.querySelector<HTMLInputElement>("#name")!,
  country: document.querySelector<HTMLSelectElement>("#country")!,
  date: document.querySelector<HTMLInputElement>("#date")!,
  note: document.querySelector<HTMLElement>("#note")!,
  location: document.querySelector<HTMLInputElement>("#location")!,
};

let controlledName = "";
elements.name.addEventListener("input", () => {
  controlledName = elements.name.value;
  queueMicrotask(() => {
    elements.name.value = controlledName;
    document.querySelector("#controlled-state")!.textContent = controlledName;
  });
});
for (const option of document.querySelectorAll<HTMLElement>("[role='option']")) {
  option.addEventListener("click", () => {
    const value = option.textContent ?? "";
    elements.location.value = value;
    elements.location.setAttribute("aria-valuetext", value);
  });
}

function discovered(
  id: keyof typeof elements,
  kind: FieldKind,
  options?: NormalizedField["options"],
): DiscoveredField {
  return {
    field: {
      id,
      adapterId: "fixture",
      pageKey: "execution",
      kind,
      label: id,
      required: false,
      currentValue: "",
      ...(options === undefined ? {} : { options }),
      evidence: { labelFor: true },
      confidence: 1,
    },
    elements: [elements[id]],
  };
}

const fields = {
  name: discovered("name", "text"),
  country: discovered("country", "native-select", [
    { label: "Choose one", value: "" },
    { label: "Canada", value: "CA" },
    { label: "Canada East", value: "CE" },
  ]),
  date: discovered("date", "date"),
  note: discovered("note", "contenteditable"),
  location: discovered("location", "combobox", [
    { label: "Toronto" },
    { label: "Toronto East" },
  ]),
};

let lastUndo: (() => Promise<unknown>) | undefined;
window.executionHarness = {
  async run(id: keyof typeof fields, value: FieldValue) {
    const result = await executeField(fields[id], value);
    lastUndo = result.undo;
    return { ok: result.ok, actualValue: result.actualValue, reason: result.reason };
  },
  async undo() {
    return lastUndo?.();
  },
};

declare global {
  interface Window {
    executionHarness: {
      run(
        id: "name" | "country" | "date" | "note" | "location",
        value: FieldValue,
      ): Promise<{ ok: boolean; actualValue: FieldValue; reason?: string }>;
      undo(): Promise<unknown>;
    };
  }
}
