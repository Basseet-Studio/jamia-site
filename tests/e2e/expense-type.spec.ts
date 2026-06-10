/**
 * E2E placeholder: expense type flow (T017).
 *
 * The full happy-path (add household + mosque expenses, badges render,
 * household filter works, household detail scopes correctly) needs the
 * Firestore emulator + signed-in admin. This placeholder mirrors the v1
 * sign-in-redirect check.
 */
import { test, expect } from "@playwright/test";

test("expenses page redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/sign-in$/);
});
