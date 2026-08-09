import type {
  FieldKind,
  NormalizedField,
  PageAnswerResult,
  RewriteResult,
} from "@job-copilot/contracts";

import type { DiscoveredField } from "../../../src/fields/discover.js";
import { executeField, type FieldValue } from "../../../src/fields/execute.js";
import { FillController } from "../../../src/fill/controller.js";
import { NormalizedFieldRegistry } from "../../../src/fields/registry.js";

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
fields.name.field.label = "First name";
fields.name.field.semanticType = "identity.firstName";

const registry = new NormalizedFieldRegistry();
registry.reconcile(Object.values(fields));
let suppliedPageAnswers: PageAnswerResult = { answers: [] };
let suppliedRewrite: RewriteResult = { fieldId: "name", value: "" };
const fillController = new FillController({
  registry,
  client: {
    async answerPage() {
      return suppliedPageAnswers;
    },
    async rewriteField() {
      return suppliedRewrite;
    },
  },
});

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
  async applyPageAnswers(result: PageAnswerResult) {
    suppliedPageAnswers = result;
    return fillController.fillPage({ pageKey: "execution", applicationId: "e2e-app" });
  },
  async applyRewrite(result: RewriteResult, currentAnswer: string) {
    suppliedRewrite = result;
    return fillController.rewrite("name", {
      applicationId: "e2e-app",
      currentAnswer,
    });
  },
  async undoFill() {
    return fillController.undoLast();
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
      applyPageAnswers(result: PageAnswerResult): Promise<unknown>;
      applyRewrite(result: RewriteResult, currentAnswer: string): Promise<unknown>;
      undoFill(): Promise<unknown>;
    };
  }
}
