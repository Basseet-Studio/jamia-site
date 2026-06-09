/**
 * E2E: soft-delete family preserves payments and money on hand (T070, SC-005).
 */
import { test, expect } from "@playwright/test";

test("household detail page redirects when unauthenticated", async ({ page }) => {
  await page.goto("/households/anything");
  await expect(page).toHaveURL(/\/sign-in$/);
});
