/**
 * E2E placeholder: per-family member-edit + history.
 *
 * Hierarchy: household -> family -> members. Members live on the family.
 * Full flow: three edits on a family's members, the per-family history
 * view shows three rows in newest-first order. Needs the Firestore
 * emulator + signed-in admin.
 */
import { test, expect } from "@playwright/test";

test("households page redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/households");
  await expect(page).toHaveURL(/\/sign-in$/);
});
