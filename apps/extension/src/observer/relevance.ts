import type { MutationBatch } from "./mutations.js";

const RELEVANT_SELECTOR = [
  "form",
  "input",
  "select",
  "textarea",
  "button",
  "[contenteditable='true']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='alert']",
  "[data-step]",
  ".g-recaptcha",
  ".h-captcha",
  "[data-sitekey]",
  "iframe[src*='captcha']",
].join(",");

const RELEVANT_TEXT =
  /application|apply|review|submit|captcha|security challenge|coding assessment|timed challenge|video interview|identity verification|electronic signature|legal attestation/i;

function relevantNode(node: Node): boolean {
  if (node instanceof Element) {
    return (
      node.matches(RELEVANT_SELECTOR) ||
      node.querySelector(RELEVANT_SELECTOR) !== null ||
      RELEVANT_TEXT.test((node.textContent ?? "").slice(0, 1_000))
    );
  }
  return node.nodeType === Node.TEXT_NODE && RELEVANT_TEXT.test(node.textContent ?? "");
}

export function mutationMayChangeApplication(batch: MutationBatch): boolean {
  return batch.records.some((record) => {
    if (record.type === "attributes") {
      return (
        record.target instanceof Element &&
        (record.target.matches(RELEVANT_SELECTOR) ||
          RELEVANT_TEXT.test((record.target.textContent ?? "").slice(0, 1_000)))
      );
    }
    return [...record.addedNodes, ...record.removedNodes].some(relevantNode);
  });
}
