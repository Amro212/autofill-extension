// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { mutationMayChangeApplication } from "./relevance.js";

async function observeOne(mutate: () => void): Promise<MutationRecord[]> {
  return new Promise((resolve) => {
    const observer = new MutationObserver((records) => {
      observer.disconnect();
      resolve(records);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    mutate();
  });
}

describe("mutation relevance", () => {
  it("ignores unrelated cosmetic mutations", async () => {
    document.body.innerHTML = '<aside id="advertisement"></aside>';
    const records = await observeOne(() => {
      document.querySelector("aside")!.className = "animated";
    });
    expect(mutationMayChangeApplication({ records, addedRoots: [], changedRoots: [] })).toBe(false);
  });

  it("detects inserted application controls and removed CAPTCHA roots", async () => {
    document.body.innerHTML = '<div class="h-captcha"></div>';
    const inserted = await observeOne(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<form><label>Email <input type="email"></label></form>',
      );
    });
    expect(mutationMayChangeApplication({ records: inserted, addedRoots: [], changedRoots: [] })).toBe(
      true,
    );

    const removed = await observeOne(() => document.querySelector(".h-captcha")!.remove());
    expect(mutationMayChangeApplication({ records: removed, addedRoots: [], changedRoots: [] })).toBe(
      true,
    );
  });

  it("detects newly rendered hard-boundary text", async () => {
    document.body.innerHTML = "";
    const records = await observeOne(() => {
      document.body.textContent = "Begin your timed coding assessment";
    });
    expect(mutationMayChangeApplication({ records, addedRoots: [], changedRoots: [] })).toBe(true);
  });
});
