/**
 * E2E: Excel Export — button presence + unauthenticated gating.
 *
 * The full download round-trip (seed → sign in → click → capture → open
 * with exceljs) is covered by:
 *   - tests/unit/services/excelExport.test.ts (pure builder assertions)
 *   - tests/unit/services/excelExport.roundtrip.test.ts (real .xlsx build +
 *     exceljs open + numeric / UTF-8 / SUM assertions)
 *
 * The Playwright suite in this repo focuses on page-render + auth-guard
 * behaviour (see `tests/e2e/*.spec.ts`); every full-flow E2E requires the
 * Firestore + auth emulators + an admin doc, which is out of scope for the
 * lightweight pre-merge gate.
 */
import { test, expect } from "@playwright/test";

test("dashboard redirects to /sign-in when unauthenticated (button never renders)", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("households page redirects to /sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/households");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("expenses page redirects to /sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("contributions page redirects to /sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/contributions");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("household detail page redirects to /sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/households/some-id");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("family history page redirects to /sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/households/some-id/families/some-fid/history");
  await expect(page).toHaveURL(/\/sign-in$/);
});
