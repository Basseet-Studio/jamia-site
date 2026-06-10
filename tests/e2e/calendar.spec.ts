/**
 * E2E placeholder: monthly calendar view (T054).
 *
 * Full flow: open /calendar, verify two groups render, step months, click
 * "Add for this month" on a NotAdded row, verify status flips and link
 * renders. Needs the Firestore emulator + signed-in admin.
 */
import { test, expect } from "@playwright/test";

test("calendar page redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/sign-in$/);
});
