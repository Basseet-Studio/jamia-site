/**
 * E2E placeholder: recurring-withdraw confirmation (T032).
 *
 * Full flow: open expanded dialog, verify name/amount/totals/shortfall
 * render, cancel keeps expense pending, confirm flips to withdrawn.
 * Needs the Firestore emulator + signed-in admin.
 */
import { test, expect } from "@playwright/test";

test("expenses page redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/sign-in$/);
});
