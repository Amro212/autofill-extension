import { describe, expect, it, vi } from "vitest";
import { config } from "zod";

describe("validation bootstrap", () => {
  it("disables dynamic schema compilation when imported", async () => {
    vi.resetModules();
    config({ jitless: false });
    await import("./validation.js");
    expect(config().jitless).toBe(true);
  });
});
