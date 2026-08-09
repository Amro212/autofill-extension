export type NavigationKind = "continue" | "review" | "submit";

export interface NavigationTarget {
  kind: NavigationKind;
  element: HTMLElement;
}

function label(element: HTMLElement): string {
  return (
    element.getAttribute("aria-label") ??
    (element instanceof HTMLInputElement ? element.value : element.textContent) ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function isEnabled(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-disabled") !== "true" &&
    (!("disabled" in element) || element.disabled !== true)
  );
}

export function classifyNavigation(document: Document): NavigationTarget[] {
  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      "button, input[type='button'], input[type='submit'], [role='button'], a[href]",
    ),
  ].filter(isEnabled);
  return controls.flatMap<NavigationTarget>((element) => {
    const text = label(element);
    if (/^(?:submit application|submit)$/.test(text)) {
      return [{ kind: "submit" as const, element }];
    }
    if (/^(?:review|review application|review and submit)$/.test(text)) {
      return [{ kind: "review" as const, element }];
    }
    if (/^(?:continue|next|save and continue|continue application)$/.test(text)) {
      return [{ kind: "continue" as const, element }];
    }
    return [];
  });
}
