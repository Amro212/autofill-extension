import type { NormalizedField } from "@job-copilot/contracts";

import type { DiscoveredField } from "./discover.js";

export class NormalizedFieldRegistry {
  readonly #fields = new Map<string, NormalizedField>();
  readonly #elements = new Map<string, HTMLElement[]>();

  reconcile(discovered: DiscoveredField[]): void {
    const nextIds = new Set(discovered.map(({ field }) => field.id));
    for (const id of this.#fields.keys()) {
      if (!nextIds.has(id)) {
        this.#fields.delete(id);
        this.#elements.delete(id);
      }
    }
    for (const item of discovered) {
      this.#fields.set(item.field.id, item.field);
      this.#elements.set(item.field.id, item.elements);
    }
  }

  list(): NormalizedField[] {
    return [...this.#fields.values()];
  }

  get(id: string): NormalizedField | undefined {
    return this.#fields.get(id);
  }

  elements(id: string): HTMLElement[] {
    return this.#elements.get(id) ?? [];
  }
}

