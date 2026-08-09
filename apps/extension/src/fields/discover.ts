import type {
  FieldKind,
  NormalizedField,
} from "@job-copilot/contracts";
import {
  createFieldSignature,
  normalizeWhitespace,
  selectBestLabel,
  type LabelEvidence,
  type LabelSource,
} from "@job-copilot/field-core";

export interface DiscoveredField {
  field: NormalizedField;
  elements: HTMLElement[];
}

function isDiscoverable(element: HTMLElement): boolean {
  if (
    element.hidden ||
    element.getAttribute("aria-hidden") === "true" ||
    element.closest("[hidden], [inert], [aria-hidden='true']") ||
    (element instanceof HTMLInputElement && element.type === "hidden")
  ) {
    return false;
  }
  const style = element.getAttribute("style") ?? "";
  return !/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

function referencedText(document: Document, ids: string | null): string | undefined {
  if (ids === null) return undefined;
  const text = ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  return normalizeWhitespace(text) || undefined;
}

function labelEvidence(element: HTMLElement): LabelEvidence {
  const document = element.ownerDocument;
  const explicit =
    element.id === ""
      ? undefined
      : [...document.querySelectorAll<HTMLLabelElement>("label[for]")].find(
          (label) => label.htmlFor === element.id,
        )?.textContent ?? undefined;
  const wrapper = element.closest("label")?.textContent ?? undefined;
  const fieldset = element.closest("fieldset");
  const legend = fieldset?.querySelector(":scope > legend")?.textContent ?? undefined;
  const fallback = element.getAttribute("name") ?? (element.id || undefined);
  return {
    ...(explicit === undefined ? {} : { labelFor: explicit }),
    ...(wrapper === undefined ? {} : { wrappingLabel: wrapper }),
    ...(element.getAttribute("aria-label") === null
      ? {}
      : { ariaLabel: element.getAttribute("aria-label")! }),
    ...(referencedText(document, element.getAttribute("aria-labelledby")) === undefined
      ? {}
      : {
          ariaLabelledBy: referencedText(
            document,
            element.getAttribute("aria-labelledby"),
          )!,
        }),
    ...(legend === undefined ? {} : { legend }),
    ...(element.getAttribute("placeholder") === null
      ? {}
      : { placeholder: element.getAttribute("placeholder")! }),
    ...(fallback === undefined ? {} : { fallback }),
  };
}

function evidenceFlags(source: LabelSource): NormalizedField["evidence"] {
  if (source === "fallback") return {};
  return { [source]: true };
}

function kindFor(element: HTMLElement, groupSize: number): FieldKind {
  if (element.getAttribute("role") === "combobox") return "combobox";
  if (element.isContentEditable || element.getAttribute("contenteditable") === "true") {
    return element.getAttribute("aria-multiline") === "true"
      ? "rich-text"
      : "contenteditable";
  }
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) {
    return element.multiple ? "multi-select" : "native-select";
  }
  if (!(element instanceof HTMLInputElement)) return "custom";
  if (element.type === "radio") return "radio-group";
  if (element.type === "checkbox") {
    return groupSize > 1 ? "checkbox-group" : "checkbox";
  }
  const mapped: Partial<Record<string, FieldKind>> = {
    email: "email",
    tel: "tel",
    url: "url",
    number: "number",
    date: "date",
    file: "file",
  };
  return mapped[element.type] ?? "text";
}

function optionLabel(element: HTMLInputElement): string {
  return (
    selectBestLabel(labelEvidence(element))?.label ??
    element.value
  );
}

function readOptions(
  element: HTMLElement,
  group: HTMLElement[],
): NormalizedField["options"] {
  if (element instanceof HTMLSelectElement) {
    return [...element.options].map((option) => ({
      label: normalizeWhitespace(option.label),
      value: option.value,
      ...(option.disabled ? { disabled: true } : {}),
    }));
  }
  if (element instanceof HTMLInputElement && ["radio", "checkbox"].includes(element.type)) {
    return group.map((member) => {
      const input = member as HTMLInputElement;
      return { label: optionLabel(input), value: input.value };
    });
  }
  if (element.getAttribute("role") === "combobox") {
    const controls = element.getAttribute("aria-controls");
    const listbox = controls
      ? element.ownerDocument.getElementById(controls)
      : element.ownerDocument.querySelector("[role='listbox']");
    return listbox
      ? [...listbox.querySelectorAll<HTMLElement>("[role='option']")]
          .filter(isDiscoverable)
          .map((option) => ({ label: normalizeWhitespace(option.textContent ?? "") }))
          .filter((option) => option.label !== "")
      : [];
  }
  return undefined;
}

function readValue(element: HTMLElement, group: HTMLElement[]) {
  if (element instanceof HTMLSelectElement) {
    return element.multiple
      ? [...element.selectedOptions].map((option) => option.value)
      : element.value;
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === "radio") {
      return (group as HTMLInputElement[]).find((input) => input.checked)?.value ?? "";
    }
    if (element.type === "checkbox") {
      return group.length === 1
        ? element.checked
        : (group as HTMLInputElement[])
            .filter((input) => input.checked)
            .map((input) => input.value);
    }
    if (element.type === "file") return [];
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement) return element.value;
  return normalizeWhitespace(
    element.getAttribute("aria-valuetext") ?? element.textContent ?? "",
  );
}

function sectionFor(element: HTMLElement): string | undefined {
  const owner = element.closest<HTMLElement>("section, fieldset, [role='group']");
  return (
    owner?.getAttribute("aria-label") ??
    (normalizeWhitespace(owner?.querySelector("h1,h2,h3,legend")?.textContent ?? "") ||
      undefined)
  );
}

export function discoverFields(document: Document, pageKey: string): DiscoveredField[] {
  const candidates = [
    ...document.querySelectorAll<HTMLElement>(
      "input:not([type='hidden']), textarea, select, [contenteditable='true'], [role='combobox']",
    ),
  ].filter(isDiscoverable);
  const processed = new Set<HTMLElement>();
  const ordinals = new Map<string, number>();
  const discovered: DiscoveredField[] = [];
  for (const element of candidates) {
    if (processed.has(element)) continue;
    const name = element instanceof HTMLInputElement ? element.name : "";
    const grouped =
      element instanceof HTMLInputElement &&
      ["radio", "checkbox"].includes(element.type) &&
      name !== ""
        ? candidates.filter(
            (candidate) =>
              candidate instanceof HTMLInputElement &&
              candidate.type === element.type &&
              candidate.name === name,
          )
        : [element];
    for (const member of grouped) processed.add(member);
    const groupLegend =
      grouped.length > 1
        ? element.closest("fieldset")?.querySelector(":scope > legend")?.textContent ??
          undefined
        : undefined;
    const selectedLabel =
      groupLegend === undefined
        ? selectBestLabel(labelEvidence(element))
        : selectBestLabel({ legend: groupLegend });
    if (selectedLabel === undefined) continue;
    const kind = kindFor(element, grouped.length);
    const section = sectionFor(element);
    const ordinalKey = `${kind}|${selectedLabel.label}`;
    const ordinal = ordinals.get(ordinalKey) ?? 0;
    ordinals.set(ordinalKey, ordinal + 1);
    const id = createFieldSignature({
      pageKey,
      kind,
      label: selectedLabel.label,
      ...(section === undefined ? {} : { section }),
      ordinal,
    });
    const options = readOptions(element, grouped);
    discovered.push({
      field: {
        id,
        adapterId: "generic",
        pageKey,
        kind,
        label: selectedLabel.label,
        ...(section === undefined ? {} : { section }),
        required:
          element.getAttribute("aria-required") === "true" ||
          ("required" in element && element.required === true),
        currentValue: readValue(element, grouped),
        ...(options === undefined ? {} : { options }),
        ...(element instanceof HTMLInputElement && element.type === "file"
          ? {
              constraints: {
                acceptedFileTypes: element.accept
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              },
            }
          : {}),
        evidence: evidenceFlags(selectedLabel.source),
        confidence: selectedLabel.source === "fallback" ? 0.55 : 0.9,
      },
      elements: grouped,
    });
  }
  return discovered;
}
