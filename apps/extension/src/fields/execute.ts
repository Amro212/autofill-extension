import { matchOption, normalizeForMatch } from "@job-copilot/field-core";

import type { BridgeAction } from "../bridge/protocol.js";
import type { DiscoveredField } from "./discover.js";
import { captureUndo } from "./undo.js";
import {
  readFieldValue,
  verifyFieldValue,
  type FieldValue,
} from "./verify.js";

export interface FieldBridge {
  execute(action: BridgeAction): Promise<{ ok: boolean }>;
}

export interface ExecuteOptions {
  bridge?: FieldBridge;
  verificationTimeoutMs?: number;
}

type BridgeActionWithoutTarget =
  | { type: "set-value"; value: string }
  | { type: "set-checked"; checked: boolean }
  | { type: "set-content"; value: string };

export interface ExecutionResult {
  ok: boolean;
  actualValue: FieldValue;
  reason?: "invalid-value" | "option-not-found" | "element-not-found" | "verification-failed";
  undo(): Promise<ExecutionResult>;
}

function emit(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("blur", { bubbles: false, composed: true }));
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter === undefined) throw new TypeError("Native value setter unavailable");
  setter.call(element, value);
}

function setNativeChecked(element: HTMLInputElement, checked: boolean): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked",
  )?.set;
  if (setter === undefined) throw new TypeError("Native checked setter unavailable");
  setter.call(element, checked);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function matchedValue(discovered: DiscoveredField, requested: string): string | undefined {
  const match = matchOption(toMatchableOptions(discovered), requested);
  return match?.value ?? match?.label;
}

function toMatchableOptions(discovered: DiscoveredField) {
  return (discovered.field.options ?? []).map((option) => ({
    label: option.label,
    ...(option.value === undefined ? {} : { value: option.value }),
    ...(option.disabled === undefined ? {} : { disabled: option.disabled }),
  }));
}

async function useBridge(
  element: HTMLElement,
  action: BridgeActionWithoutTarget,
  bridge: FieldBridge,
): Promise<boolean> {
  const targetId = crypto.randomUUID().replaceAll("-", "");
  element.dataset.jobCopilotTarget = targetId;
  try {
    return (await bridge.execute({ ...action, targetId } as BridgeAction)).ok;
  } finally {
    delete element.dataset.jobCopilotTarget;
  }
}

async function applyValue(
  discovered: DiscoveredField,
  requested: FieldValue,
  bridge?: FieldBridge,
): Promise<{ expected?: FieldValue; reason?: ExecutionResult["reason"] }> {
  const [element] = discovered.elements;
  if (element === undefined) return { reason: "element-not-found" };
  const kind = discovered.field.kind;

  if (kind === "radio-group") {
    const value = stringValue(requested);
    if (value === undefined) return { reason: "invalid-value" };
    const selected = matchedValue(discovered, value);
    if (selected === undefined) return { reason: "option-not-found" };
    const inputs = discovered.elements as HTMLInputElement[];
    const target = inputs.find((input) => input.value === selected);
    if (target === undefined) return { reason: "option-not-found" };
    for (const input of inputs) setNativeChecked(input, input === target);
    emit(target);
    return { expected: target.value };
  }

  if (kind === "checkbox-group") {
    if (!Array.isArray(requested) || !requested.every((value) => typeof value === "string")) {
      return { reason: "invalid-value" };
    }
    const selected = requested.map((value) => matchedValue(discovered, value));
    if (selected.some((value) => value === undefined)) {
      return { reason: "option-not-found" };
    }
    const values = selected as string[];
    for (const input of discovered.elements as HTMLInputElement[]) {
      setNativeChecked(input, values.includes(input.value));
      emit(input);
    }
    return { expected: values };
  }

  if (kind === "checkbox") {
    if (typeof requested !== "boolean" || !(element instanceof HTMLInputElement)) {
      return { reason: "invalid-value" };
    }
    setNativeChecked(element, requested);
    emit(element);
    return { expected: requested };
  }

  if (kind === "native-select") {
    const value = stringValue(requested);
    if (value === undefined || !(element instanceof HTMLSelectElement)) {
      return { reason: "invalid-value" };
    }
    const selected = matchedValue(discovered, value);
    if (selected === undefined) return { reason: "option-not-found" };
    setNativeValue(element, selected);
    emit(element);
    return { expected: selected };
  }

  if (kind === "combobox" || kind === "autocomplete") {
    const value = stringValue(requested);
    if (value === undefined) return { reason: "invalid-value" };
    const selected = matchOption(toMatchableOptions(discovered), value);
    if (selected === undefined) return { reason: "option-not-found" };
    const controls = element.getAttribute("aria-controls");
    const listbox = controls
      ? element.ownerDocument.getElementById(controls)
      : element.ownerDocument.querySelector<HTMLElement>("[role='listbox']");
    const option = [...(listbox?.querySelectorAll<HTMLElement>("[role='option']") ?? [])].find(
      (candidate) =>
        normalizeForMatch(candidate.textContent ?? "") === normalizeForMatch(selected.label),
    );
    if (option === undefined) return { reason: "option-not-found" };
    option.click();
    return { expected: selected.value ?? selected.label };
  }

  const value = stringValue(requested);
  if (value === undefined) return { reason: "invalid-value" };
  if (kind === "contenteditable" || kind === "rich-text") {
    if (bridge !== undefined) {
      await useBridge(element, { type: "set-content", value }, bridge);
    } else {
      element.textContent = value;
      emit(element);
    }
    return { expected: value };
  }
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return { reason: "invalid-value" };
  }
  if (bridge !== undefined) {
    await useBridge(element, { type: "set-value", value }, bridge);
  } else {
    setNativeValue(element, value);
    emit(element);
  }
  return { expected: value };
}

async function restoreExact(
  discovered: DiscoveredField,
  restored: FieldValue,
  options: ExecuteOptions,
): Promise<ExecutionResult> {
  const current = readFieldValue(discovered);
  const [element] = discovered.elements;
  if (element === undefined) {
    return result(false, "", "element-not-found", async () =>
      restoreExact(discovered, current, options),
    );
  }
  const kind = discovered.field.kind;
  if (kind === "radio-group") {
    for (const input of discovered.elements as HTMLInputElement[]) {
      setNativeChecked(input, typeof restored === "string" && input.value === restored);
      emit(input);
    }
  } else if (kind === "checkbox-group") {
    if (!Array.isArray(restored)) {
      return result(false, current, "invalid-value", async () =>
        restoreExact(discovered, current, options),
      );
    }
    for (const input of discovered.elements as HTMLInputElement[]) {
      setNativeChecked(input, restored.includes(input.value));
      emit(input);
    }
  } else if (kind === "checkbox") {
    if (typeof restored !== "boolean" || !(element instanceof HTMLInputElement)) {
      return result(false, current, "invalid-value", async () =>
        restoreExact(discovered, current, options),
      );
    }
    setNativeChecked(element, restored);
    emit(element);
  } else if (element instanceof HTMLSelectElement) {
    if (typeof restored !== "string") {
      return result(false, current, "invalid-value", async () =>
        restoreExact(discovered, current, options),
      );
    }
    setNativeValue(element, restored);
    emit(element);
  } else if (kind === "contenteditable" || kind === "rich-text") {
    if (typeof restored !== "string") {
      return result(false, current, "invalid-value", async () =>
        restoreExact(discovered, current, options),
      );
    }
    if (options.bridge === undefined) {
      element.textContent = restored;
      emit(element);
    } else {
      await useBridge(element, { type: "set-content", value: restored }, options.bridge);
    }
  } else if (
    kind === "combobox" ||
    kind === "autocomplete"
  ) {
    if (typeof restored !== "string") {
      return result(false, current, "invalid-value", async () =>
        restoreExact(discovered, current, options),
      );
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setNativeValue(element, restored);
    } else {
      element.textContent = restored;
    }
    element.setAttribute("aria-valuetext", restored);
    emit(element);
  } else {
    if (
      typeof restored !== "string" ||
      (!(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement))
    ) {
      return result(false, current, "invalid-value", async () =>
        restoreExact(discovered, current, options),
      );
    }
    if (options.bridge === undefined) {
      setNativeValue(element, restored);
      emit(element);
    } else {
      await useBridge(element, { type: "set-value", value: restored }, options.bridge);
    }
  }
  const actual = await verifyFieldValue(
    discovered,
    restored,
    options.verificationTimeoutMs,
  );
  return result(
    actual !== undefined,
    actual ?? readFieldValue(discovered),
    actual === undefined ? "verification-failed" : undefined,
    async () => restoreExact(discovered, current, options),
  );
}

export async function executeField(
  discovered: DiscoveredField,
  requested: FieldValue,
  options: ExecuteOptions = {},
): Promise<ExecutionResult> {
  const previous = captureUndo(discovered, readFieldValue(discovered));
  const [element] = discovered.elements;
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  const applied = await applyValue(discovered, requested, options.bridge);
  if (applied.expected === undefined) {
    return result(false, readFieldValue(discovered), applied.reason, async () =>
      restoreExact(previous.discovered, previous.value, options),
    );
  }
  const actual = await verifyFieldValue(
    discovered,
    applied.expected,
    options.verificationTimeoutMs,
  );
  return result(
    actual !== undefined,
    actual ?? readFieldValue(discovered),
    actual === undefined ? "verification-failed" : undefined,
    async () => restoreExact(previous.discovered, previous.value, options),
  );
}

function result(
  ok: boolean,
  actualValue: FieldValue,
  reason: ExecutionResult["reason"],
  undo: () => Promise<ExecutionResult>,
): ExecutionResult {
  return {
    ok,
    actualValue,
    ...(reason === undefined ? {} : { reason }),
    undo,
  };
}
