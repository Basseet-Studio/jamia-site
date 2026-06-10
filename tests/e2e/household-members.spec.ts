/**
 * E2E placeholder: household member-edit + history (T044).
 *
 * Full flow: three edits on a household, history view shows three rows
 * in newest-first order. Needs the Firestore emulator + signed-in admin.
 */
import { test, expect } from "@playwright/test";

test("households page redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/households");
  await expect(page).toHaveURL(/\/sign-in$/);
});
