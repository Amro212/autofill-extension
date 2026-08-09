// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { keepUiMounted } from "./lifecycle.js";

describe("keepUiMounted", () => {
  it("reattaches the existing shadow host after page hydration removes it", async () => {
    const shadowHost = document.createElement("job-copilot-panel");
    const mount = vi.fn(() => document.body.append(shadowHost));
    const stop = keepUiMounted({ mount, shadowHost }, document);

    document.body.replaceChildren(document.createElement("main"));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(shadowHost.isConnected).toBe(true);
    expect(mount).toHaveBeenCalledTimes(1);
    stop();
  });
});
