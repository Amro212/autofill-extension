import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/automation.html");
});

test("repairs a rejected answer, uploads through a hidden input, and stops at review", async ({
  page,
}) => {
  const result = await page.evaluate(() => window.automationHarness.run(false));

  expect(result).toMatchObject({
    repairAttempts: 1,
    uploaded: true,
    finalStatus: "review-required",
    step: "review",
  });
  await expect(page.locator("#city")).toHaveCount(0);
  await expect(page.locator("#resume-name")).toHaveText("resume.pdf");
  await expect(page.getByRole("heading", { name: "Review application" })).toBeVisible();
});

test("Auto Submit submits only the verified final page and observes confirmation", async ({
  page,
}) => {
  const result = await page.evaluate(() => window.automationHarness.run(true));

  expect(result).toMatchObject({ finalStatus: "submitted", step: "confirmation" });
  await expect(page.getByText("Application received")).toBeVisible();
});

test("waits for CAPTCHA clearance without interacting with the challenge", async ({ page }) => {
  const result = await page.evaluate(() => window.automationHarness.waitThroughCaptcha());

  expect(result).toEqual({ cleared: true, clicks: 0 });
  await expect(page.locator(".h-captcha")).toHaveCount(0);
});

test("pauses at every hard user boundary", async ({ page }) => {
  for (const boundary of [
    "assessment",
    "video-interview",
    "identity-verification",
    "electronic-signature",
    "legal-attestation",
  ] as const) {
    await expect(
      page.evaluate((type) => window.automationHarness.checkBoundary(type), boundary),
    ).resolves.toMatchObject({ type: boundary, navigation: "user-boundary", clicks: 0 });
  }
});
