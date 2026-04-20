// Settings panel specs. Covers the tabbed modal reached from the UserMenu →
// Settings: Account (profile / sign-out / delete stub), AI (OpenAI key +
// persona), and Appearance (theme). Each test opens directly into the tab
// it's exercising so assertions can run without a second click.

import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/auth";

import { mockAllAI } from "../fixtures/aiMocks";
import { markOnboardingDone, seedApiKey } from "../fixtures/profiles";
import * as S from "../utils/selectors";

async function openSettings(
  page: Page,
  tab?: "account" | "ai" | "appearance",
): Promise<void> {
  await S.openSettings(page, tab);
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

test.describe("settings panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAI(page);
    await markOnboardingDone(page);
  });

  test("Theme toggle applies data-theme on <html> and persists pref", async ({ page }) => {
    await page.goto("/");
    await openSettings(page, "appearance");

    // Light — Phase 18b: theme persists through `preferences.theme` on the
    // server; the only user-visible effect we can assert here without racing
    // the PATCH is the <html data-theme> attribute. A later reload-persists
    // case is covered by cross-device.spec.ts.
    await page.getByRole("button", { name: /^light$/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Dark
    await page.getByRole("button", { name: /^dark$/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Close + reopen settings on Appearance — selected button should remain
    // aria-pressed=true.
    await page.keyboard.press("Escape");
    await openSettings(page, "appearance");
    await expect(page.getByRole("button", { name: /^dark$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("Persona radio group updates aria-checked and blurb", async ({ page }) => {
    await page.goto("/");
    await openSettings(page, "ai");

    const beginner = page.getByRole("radio", { name: /^beginner$/i });
    const advanced = page.getByRole("radio", { name: /^advanced$/i });

    await beginner.click();
    await expect(beginner).toHaveAttribute("aria-checked", "true");
    await expect(advanced).toHaveAttribute("aria-checked", "false");
    // Descriptive blurb flips with the selection.
    await expect(page.getByText(/assumes little prior knowledge/i)).toBeVisible();

    await advanced.click();
    await expect(advanced).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/dense and technical/i)).toBeVisible();
  });

  test("Show / hide API key toggle flips the input type", async ({ page }) => {
    await seedApiKey(page, { key: "sk-test-visibility" });
    await page.goto("/");
    await openSettings(page, "ai");

    const keyInput = page.locator('input[placeholder="sk-…"]');
    await expect(keyInput).toHaveAttribute("type", "password");

    // The reveal toggle carries a dynamic aria-label — "Show API key" while
    // hidden, "Hide API key" once revealed.
    await page.getByRole("button", { name: /^show api key$/i }).click();
    await expect(keyInput).toHaveAttribute("type", "text");
    await expect(keyInput).toHaveValue("sk-test-visibility");

    await page.getByRole("button", { name: /^hide api key$/i }).click();
    await expect(keyInput).toHaveAttribute("type", "password");
  });

  test("Validate key → model picker loads → model change persists", async ({ page }) => {
    await page.goto("/");
    await openSettings(page, "ai");

    // Type a key and validate — mockAllAI's validate returns {valid:true}
    // and models returns gpt-4o-mini + gpt-4o. The validate button's
    // accessible name is "Validate API key" (dynamic aria-label).
    await page.locator('input[placeholder="sk-…"]').fill("sk-valid-test");
    await page.getByRole("button", { name: /^validate api key$/i }).click();

    // Valid pill renders, then the Model picker appears.
    await expect(page.getByText(/● valid/i)).toBeVisible({ timeout: 5_000 });
    const modelSelect = page.getByRole("combobox", { name: /^model$/i });
    await expect(modelSelect).toBeVisible({ timeout: 5_000 });

    // Both mocked options should be there.
    await expect(modelSelect.locator("option")).toHaveCount(2);

    // Change selection — the <select> reflects the new value synchronously;
    // cross-device persistence is covered in cross-device.spec.ts.
    await modelSelect.selectOption("gpt-4o");
    await expect(modelSelect).toHaveValue("gpt-4o");
  });

  test("Invalid key surfaces the error and hides the Model picker", async ({ page }) => {
    // Override the default validate-key mock with an invalid response BEFORE
    // navigating so the route is installed first.
    await page.route("**/api/ai/validate-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ valid: false, error: "bad key format" }),
      });
    });
    await page.goto("/");
    await openSettings(page, "ai");

    await page.locator('input[placeholder="sk-…"]').fill("sk-nope");
    await page.getByRole("button", { name: /^validate api key$/i }).click();

    // Error blurb renders with the message from the mock.
    await expect(page.getByText(/× bad key format/i)).toBeVisible({ timeout: 5_000 });
    // Model picker did NOT appear.
    await expect(page.getByRole("combobox", { name: /^model$/i })).toHaveCount(0);
  });

  test("Remove API key is a two-step confirm (Cancel keeps, Remove wipes)", async ({ page }) => {
    await seedApiKey(page, { key: "sk-about-to-be-removed" });
    await page.goto("/");
    await openSettings(page, "ai");

    // First click — inline confirm pill appears with Remove + Cancel buttons.
    await page.getByRole("button", { name: /^remove api key$/i }).click();
    await expect(page.getByText(/also clears your tutor chat/i)).toBeVisible();

    // Cancel path — key stays put.
    await page
      .getByRole("button", { name: /^cancel$/i })
      .filter({ hasText: /^cancel$/i })
      .last()
      .click();
    await expect(page.getByText(/also clears your tutor chat/i)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("codetutor:openai-key"))).toBe(
      "sk-about-to-be-removed",
    );

    // Now actually remove it.
    await page.getByRole("button", { name: /^remove api key$/i }).click();
    await page
      .getByRole("button", { name: /^remove$/i })
      .filter({ hasText: /^remove$/i })
      .last()
      .click();

    // The API-key input clears and the Remove API key affordance disappears
    // because the component hides it when apiKey is empty.
    await expect(page.locator('input[placeholder="sk-…"]')).toHaveValue("");
    await expect(page.getByRole("button", { name: /^remove api key$/i })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("codetutor:openai-key"))).toBeNull();
  });

  test("Escape closes the settings modal cleanly", async ({ page }) => {
    await seedApiKey(page, { key: "sk-escape-test" });
    await page.goto("/");
    await openSettings(page, "ai");

    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // Reopening on AI shows the same seeded key — state survives the close.
    await openSettings(page, "ai");
    await expect(page.locator('input[placeholder="sk-…"]')).toHaveValue("sk-escape-test");
  });
});
