/**
 * Partial dump import restore screen.
 * Filename copy is asserted in tests/unit/ui/DumpImportPartialFailure.test.tsx.
 * Unauthenticated users never reach Dump DB (no toast).
 */
import { test, expect } from "@playwright/test";

test("settings dump UI is behind sign-in (no toast dump path)", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
});
