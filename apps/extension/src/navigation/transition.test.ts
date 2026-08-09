// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { pageTransitionSignature, waitForPageTransition } from "./transition.js";

describe("page transition observation", () => {
  it("resolves after a SPA replaces the application step", async () => {
    document.body.innerHTML = '<main data-step="one"><h1>Contact</h1><input id="email"></main>';
    const before = pageTransitionSignature(document, window);
    const waiting = waitForPageTransition(document, window, before, { timeoutMs: 200 });

    queueMicrotask(() => {
      document.body.innerHTML = '<main data-step="two"><h1>Experience</h1><input id="company"></main>';
    });

    await expect(waiting).resolves.toBe(true);
  });

  it("times out without polling forever when the page does not transition", async () => {
    document.body.innerHTML = "<main><h1>Contact</h1></main>";
    await expect(
      waitForPageTransition(document, window, pageTransitionSignature(document, window), {
        timeoutMs: 10,
      }),
    ).resolves.toBe(false);
  });
});
