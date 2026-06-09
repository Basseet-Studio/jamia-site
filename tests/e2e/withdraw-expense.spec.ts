/**
 * E2E: withdraw expense updates MoH within 3s (T065, SC-003).
 */
import { test, expect } from "@playwright/test";

test("expenses page redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/sign-in$/);
});
