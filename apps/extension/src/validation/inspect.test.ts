// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { discoverFields } from "../fields/discover.js";
import { NormalizedFieldRegistry } from "../fields/registry.js";
import { inspectValidation } from "./inspect.js";
import { repairLocally } from "./repair.js";
import { ValidationRepairController } from "./repair.js";

describe("validation inspection and local repair", () => {
  it("maps native, ARIA, and site errors back to normalized fields", () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Email</label>
        <input id="email" type="email" required value="">
        <label for="phone">Phone</label>
        <input id="phone" aria-invalid="true" aria-describedby="phone-error">
        <span id="phone-error" role="alert">Enter a valid phone number</span>
      </form>`;
    const registry = new NormalizedFieldRegistry();
    registry.reconcile(discoverFields(document, "apply"));

    const issues = inspectValidation(document, registry);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldId: registry.list().find((field) => field.label === "Email")?.id,
          code: "required",
          severity: "error",
        }),
        expect.objectContaining({
          fieldId: registry.list().find((field) => field.label === "Phone")?.id,
          code: "aria-invalid",
          message: "Enter a valid phone number",
        }),
      ]),
    );
  });

  it("maps a linked page-level error summary back to its field", () => {
    document.body.innerHTML = `
      <form>
        <label for="postal">Postal code</label>
        <input id="postal" name="postal">
      </form>
      <div class="error-summary" role="alert">
        <a href="#postal">Postal code is not valid</a>
      </div>`;
    const registry = new NormalizedFieldRegistry();
    registry.reconcile(discoverFields(document, "apply"));
    const fieldId = registry.list().find(({ label }) => label === "Postal code")!.id;

    expect(inspectValidation(document, registry)).toContainEqual(
      expect.objectContaining({
        fieldId,
        code: "site-error",
        message: "Postal code is not valid",
      }),
    );
  });

  it("repairs deterministic constraint failures and verifies actual state", async () => {
    const input = document.createElement("input");
    input.value = "abcdefgh";
    input.maxLength = 5;
    input.scrollIntoView = vi.fn();
    const registry = new NormalizedFieldRegistry();
    const [item] = discoverFields(
      new DOMParser().parseFromString(
        '<label for="answer">Answer</label><input id="answer" maxlength="5" value="abcdefgh">',
        "text/html",
      ),
      "apply",
    );
    expect(item).toBeDefined();
    registry.reconcile([{ ...item!, elements: [input] }]);

    const result = await repairLocally(
      {
        fieldId: item!.field.id,
        code: "too-long",
        message: "Use at most 5 characters",
        severity: "error",
      },
      registry,
    );

    expect(result).toMatchObject({ repaired: true, value: "abcde" });
    expect(input.value).toBe("abcde");
  });

  it("uses at most two AI repair attempts for semantic rejection", async () => {
    document.body.innerHTML = `
      <label for="city">City</label>
      <input id="city" aria-invalid="true" aria-describedby="city-error">
      <span id="city-error" role="alert">Use the full city name</span>`;
    const input = document.querySelector<HTMLInputElement>("#city")!;
    input.scrollIntoView = vi.fn();
    input.addEventListener("input", () => {
      const valid = input.value === "Toronto";
      input.setAttribute("aria-invalid", String(!valid));
      document.querySelector("#city-error")!.textContent = valid
        ? ""
        : "Use the full city name";
    });
    const registry = new NormalizedFieldRegistry();
    registry.reconcile(discoverFields(document, "apply"));
    const fieldId = registry.list()[0]!.id;
    const answerPage = vi
      .fn()
      .mockResolvedValueOnce({ answers: [{ fieldId, value: "TO" }] })
      .mockResolvedValueOnce({ answers: [{ fieldId, value: "Toronto" }] });
    const controller = new ValidationRepairController({ registry, answerPage });

    const result = await controller.repairPage(document, { pageKey: "apply" });

    expect(result).toMatchObject({ repaired: true, aiAttempts: 2, issues: [] });
    expect(answerPage).toHaveBeenCalledTimes(2);
    expect(input.value).toBe("Toronto");
  });
});
