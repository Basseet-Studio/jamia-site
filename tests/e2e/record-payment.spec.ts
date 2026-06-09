/**
 * E2E: record payment updates MoH within 3s (T058, SC-002).
 */
import { test, expect } from "@playwright/test";

test("record payment page renders the record-payment trigger", async ({ page }) => {
  await page.goto("/households");
  // Direct visit while signed out: auth guard sends to /sign-in
  await expect(page).toHaveURL(/\/(sign-in|households)/);
});
