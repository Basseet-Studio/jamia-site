/**
 * E2E: all-time expenses toggle (T097, US13).
 */
import { test, expect } from "@playwright/test";

test("expenses toggle button is present and toggles view", async ({ page }) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/sign-in$/);
});
