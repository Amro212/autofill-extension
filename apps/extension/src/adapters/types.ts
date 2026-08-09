import type { NavigationKind } from "../navigation/classify.js";

export type AtsPageKind = "listing" | "application" | "unknown";

export interface AtsAdapter {
  id: string;
  matches(url: URL, document: Document): boolean;
  pageKind(document: Document): AtsPageKind;
  isFinalPage(document: Document): boolean;
  shouldIgnore(element: HTMLElement): boolean;
  navigationKind(element: HTMLElement): NavigationKind | undefined;
}
