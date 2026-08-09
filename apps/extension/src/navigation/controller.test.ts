// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { NavigationController } from "./controller.js";

describe("automatic navigation", () => {
  it("does not continue while validation errors remain", async () => {
    document.body.innerHTML = '<button type="button">Continue</button>';
    const button = document.querySelector("button")!;
    const click = vi.spyOn(button, "click");
    const controller = new NavigationController({
      inspectValidation: () => [
        { code: "required", message: "Email is required", severity: "error" },
      ],
      waitForTransition: vi.fn(),
    });

    await expect(
      controller.advance(document, {
        autoContinue: true,
        autoSubmit: false,
        pageType: "application",
      }),
    ).resolves.toMatchObject({ status: "validation-blocked" });
    expect(click).not.toHaveBeenCalled();
  });

  it("retries a failed Continue transition within a strict budget", async () => {
    document.body.innerHTML = '<button type="button">Continue</button>';
    const click = vi.spyOn(document.querySelector("button")!, "click");
    const waitForTransition = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const controller = new NavigationController({
      inspectValidation: () => [],
      waitForTransition,
      maxAttempts: 3,
    });

    await expect(
      controller.advance(document, {
        autoContinue: true,
        autoSubmit: false,
        pageType: "application",
      }),
    ).resolves.toMatchObject({ status: "navigated", attempts: 2 });
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("stops on final review unless Auto Submit is explicitly enabled", async () => {
    document.body.innerHTML = '<button type="submit">Submit application</button>';
    const click = vi.spyOn(document.querySelector("button")!, "click");
    const controller = new NavigationController({
      inspectValidation: () => [],
      waitForTransition: async () => true,
    });

    await expect(
      controller.advance(document, {
        autoContinue: true,
        autoSubmit: false,
        pageType: "review",
      }),
    ).resolves.toMatchObject({ status: "review-required" });
    expect(click).not.toHaveBeenCalled();

    await expect(
      controller.advance(document, {
        autoContinue: true,
        autoSubmit: true,
        pageType: "review",
      }),
    ).resolves.toMatchObject({ status: "submitted" });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("never treats a Submit-labelled control as final without final-page classification", async () => {
    document.body.innerHTML = '<button type="submit">Submit application</button>';
    const click = vi.spyOn(document.querySelector("button")!, "click");
    const controller = new NavigationController({
      inspectValidation: () => [],
      waitForTransition: async () => true,
    });

    await expect(
      controller.advance(document, {
        autoContinue: true,
        autoSubmit: true,
        pageType: "application",
      }),
    ).resolves.toMatchObject({ status: "control-not-found" });
    expect(click).not.toHaveBeenCalled();
  });

  it("never navigates through CAPTCHA or user boundaries", async () => {
    document.body.innerHTML = `
      <div class="h-captcha"></div>
      <button type="submit">Submit application</button>`;
    const click = vi.spyOn(document.querySelector("button")!, "click");
    const controller = new NavigationController({
      inspectValidation: () => [],
      waitForTransition: async () => true,
    });

    await expect(
      controller.advance(document, {
        autoContinue: true,
        autoSubmit: true,
        pageType: "captcha",
      }),
    ).resolves.toMatchObject({ status: "captcha" });
    expect(click).not.toHaveBeenCalled();
  });
});
