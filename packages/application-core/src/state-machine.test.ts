import { describe, expect, it } from "vitest";

import { canTransition, transitionApplication } from "./index.js";

describe("application state transitions", () => {
  it("allows the default application start flow", () => {
    expect(canTransition("APPLICATION_LINKED", "WAITING_FOR_USER_START")).toBe(
      true,
    );
    expect(canTransition("WAITING_FOR_USER_START", "SCANNING")).toBe(true);
  });

  it("rejects skipping from discovery directly to submission", () => {
    expect(canTransition("DISCOVERED", "SUBMITTING")).toBe(false);
    expect(() => transitionApplication("DISCOVERED", "SUBMITTING")).toThrow(
      "Illegal application transition: DISCOVERED -> SUBMITTING",
    );
  });

  it("allows pause from active work and resume to scanning", () => {
    expect(canTransition("FILLING", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "SCANNING")).toBe(true);
  });
});
