// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { classifyBoundary, waitForCaptchaClear } from "./classify.js";

describe("user boundaries", () => {
  it.each([
    ["<h1>Coding assessment</h1><p>This timed challenge is 60 minutes.</p>", "assessment"],
    ["<h1>Recorded video interview</h1>", "video-interview"],
    ["<h1>Identity verification</h1><p>Upload government ID.</p>", "identity-verification"],
    ["<h1>Electronic signature</h1><label>Type your legal name</label>", "electronic-signature"],
    ["<label><input type='checkbox'>I certify under penalty of perjury that this is true</label>", "legal-attestation"],
  ])("classifies %s as %s", (html, expected) => {
    document.body.innerHTML = html;
    expect(classifyBoundary(document).type).toBe(expected);
  });

  it("observes CAPTCHA clearance without clicking or manipulating it", async () => {
    document.body.innerHTML = `
      <div class="g-recaptcha"><button>Verify</button></div>
      <form><label>Email <input type="email"></label></form>`;
    const click = vi.spyOn(document.querySelector("button")!, "click");
    const waiting = waitForCaptchaClear(document, { timeoutMs: 200 });
    queueMicrotask(() => document.querySelector(".g-recaptcha")?.remove());

    await expect(waiting).resolves.toBe(true);
    expect(click).not.toHaveBeenCalled();
    expect(classifyBoundary(document).type).toBe("none");
  });
});
