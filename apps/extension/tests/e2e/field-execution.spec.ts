import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("reconciles controlled text, dates, and contenteditable state", async ({ page }) => {
  await expect(
    page.evaluate(() => window.executionHarness.run("name", "Grace Hopper")),
  ).resolves.toMatchObject({ ok: true, actualValue: "Grace Hopper" });
  await expect(page.locator("#name")).toHaveValue("Grace Hopper");
  await expect(page.locator("#controlled-state")).toHaveText("Grace Hopper");

  await page.evaluate(() => window.executionHarness.run("date", "2026-08-09"));
  await expect(page.locator("#date")).toHaveValue("2026-08-09");
  await page.evaluate(() => window.executionHarness.run("note", "Hello team"));
  await expect(page.locator("#note")).toHaveText("Hello team");
});

test("uses bounded option matching and restores exact prior state", async ({ page }) => {
  await page.evaluate(() => window.executionHarness.run("country", "Canada"));
  await expect(page.locator("#country")).toHaveValue("CA");
  await page.evaluate(() => window.executionHarness.undo());
  await expect(page.locator("#country")).toHaveValue("");

  const unmatched = await page.evaluate(() =>
    window.executionHarness.run("country", "Atlantis"),
  );
  expect(unmatched).toMatchObject({ ok: false, reason: "option-not-found" });
  await expect(page.locator("#country")).toHaveValue("");
});

test("selects the exact combobox option", async ({ page }) => {
  await page.evaluate(() => window.executionHarness.run("location", "Toronto"));
  await expect(page.locator("#location")).toHaveAttribute("aria-valuetext", "Toronto");
});
