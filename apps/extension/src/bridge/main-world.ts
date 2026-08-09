import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  parseSerializedRequest,
  type BridgeAction,
  type BridgeResponse,
} from "./protocol.js";

function targetFor(targetId: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[data-job-copilot-target]")].find(
    (element) => element.dataset.jobCopilotTarget === targetId,
  );
}

function emit(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("blur", { composed: true }));
}

function setValue(element: HTMLElement, value: string): string {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : undefined;
  const setter =
    prototype === undefined
      ? undefined
      : Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter === undefined) throw new TypeError("unsupported-target");
  setter.call(element, value);
  emit(element);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element.value;
  }
  throw new TypeError("unsupported-target");
}

function apply(action: BridgeAction): string | boolean {
  const element = targetFor(action.targetId);
  if (element === undefined) throw new TypeError("target-not-found");
  if (action.type === "set-value") return setValue(element, action.value);
  if (action.type === "set-checked") {
    if (!(element instanceof HTMLInputElement)) {
      throw new TypeError("unsupported-target");
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    )?.set;
    if (setter === undefined) throw new TypeError("unsupported-target");
    setter.call(element, action.checked);
    emit(element);
    return element.checked;
  }
  element.textContent = action.value;
  emit(element);
  return element.textContent ?? "";
}

export function installMainWorldBridge(
  script: HTMLScriptElement,
  channelId: string,
): () => void {
  const respond = (response: BridgeResponse) => {
    script.dispatchEvent(
      new CustomEvent(BRIDGE_RESPONSE_EVENT, { detail: JSON.stringify(response) }),
    );
  };
  const onRequest = (event: Event) => {
    try {
      const request = parseSerializedRequest((event as CustomEvent).detail);
      if (request.channelId !== channelId) return;
      try {
        respond({
          channelId,
          requestId: request.requestId,
          ok: true,
          actualValue: apply(request.action),
        });
      } catch {
        respond({
          channelId,
          requestId: request.requestId,
          ok: false,
          error: "action-failed",
        });
      }
    } catch {
      // Invalid and cross-channel messages are intentionally ignored.
    }
  };
  script.addEventListener(BRIDGE_REQUEST_EVENT, onRequest);
  return () => script.removeEventListener(BRIDGE_REQUEST_EVENT, onRequest);
}
