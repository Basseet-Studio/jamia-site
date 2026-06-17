# Quickstart: Payment Contribution Spillover

**Branch**: `003-payment-spillover` | **Date**: 2026-06-17

End-to-end smoke test for the spillover feature. Assumes the dev has followed the project README to install deps, seed settings, and start the Firestore emulator.

---

## Setup

```bash
# From repo root
pnpm install
pnpm seed:settings              # seeds settings/global (required by shiftMoneyOnHandInTx)
pnpm emulators:start &          # auth + firestore emulators on 127.0.0.1
pnpm dev                        # Next.js dev server on :3000
```

In the browser:
1. Sign in as the first admin (auto-promoted per v1).
2. Create a household "Test HH".
3. Add a family "Test Family" with `contributionTarget = 500`, `createdAt = 2026-01-15`.

---

## Scenario 1 — Over-limit indicator (P1)

1. Navigate to Household Detail → Test Family.
2. Click **Record Payment**.
3. Type `300` in amount → no over-limit indicator shown.
4. Type `600` → **"Over limit by 100"** appears immediately.
5. Type `500` → indicator disappears.

**Expected**: live update within ~100ms of keystroke (SC-005).

---

## Scenario 2 — Auto-cascade to back months (P1)

1. Continue from Scenario 1 (no payments saved yet — reset amount to `0`).
2. Type `1500`, date `2026-06-17`.
3. Preview should list:
   - **June 2026 (current)** — 500
   - **January 2026** — 500 (oldest unpaid back, filled first)
   - **February 2026** — 500
   - Total: 1500 across 3 months, no remainder.
4. Note field optional. Click Save.
5. Open the payment history → 3 rows, all `date = 2026-06-17`, all `month = 2026-06 / 2026-01 / 2026-02`, all share a `coverageGroupId` (visible by expanding any row).

**Verify in Firestore emulator UI** (http://127.0.0.1:4000/firestore):
- `households/{hh}/families/{fid}/payments/` shows 3 docs.
- `settings/global.moneyOnHand` increased by `1500` in one commit.

---

## Scenario 3 — Partial back cascade (P1)

1. Continue: type `1700`, preview shows:
   - June 2026 (current) — 500
   - Jan 2026 — 500
   - Feb 2026 — 500
   - "Remaining over-limit on June 2026: 200"
2. Save → 3 docs, current-month doc amount = `500`, group total = `1500` (NOT `1700`).

**Verify**: `settings/global.moneyOnHand` increased by `1500`, not `1700`.

---

## Scenario 4 — Future-months opt-in (P2)

1. Pre-pay all months from Jan–Jun 2026 for this family (use 6 separate payments at 500 each, OR run Scenario 2's exact cascade six times).
2. After step 1, navigate to Test Family. All months Jan–Jun show "Met" in the status column.
3. Click **Record Payment**, type `1500`, date `2026-06-17`.
4. Observe the **"Apply excess to future months"** checkbox appears (unchecked). The back-months section of the preview is empty.
5. Tick the checkbox → preview updates to include:
   - June 2026 (current) — 500
   - July 2026 — 500 (future)
   - August 2026 — 500 (future)
   - Total: 1500, no remainder.
6. Save → 3 docs, group total = `1500`.

---

## Scenario 5 — Future-months without back cascade (P2)

Same setup as Scenario 4, but **do not tick** the checkbox. Preview shows only June 2026 (current) at 500, with "Remaining over-limit on June 2026: 1000". Save → only 1 doc created, `moneyOnHand` up by `500` (not `1500`). The `1000` over-limit is recorded only in the dialog preview, not as separate docs.

---

## Scenario 6 — Delete coverage group (P3)

1. After Scenario 2, click delete on the current-month (June 2026) payment row.
2. Confirm dialog reads: **"This will also remove 2 cascaded payment(s) in this coverage group: January 2026, February 2026. Continue?"**
3. Confirm → all 3 docs removed in one operation; `moneyOnHand` decreased by `1500` in one commit.

**Verify**: refresh the page — no payments remain under Test Family; `moneyOnHand` is back to pre-Scenario-2 value.

---

## Scenario 7 — Legacy payment delete (regression, P3)

1. Manually create a payment via the emulator UI (no `coverageGroupId` field) for May 2026 at 500.
2. Back in the app, click delete on this row.
3. Confirm dialog shows the **legacy single-doc** prompt (no "cascaded" mention).
4. Confirm → 1 doc deleted, `moneyOnHand` down by 500.

**Verify**: legacy path still works (FR-028 / FR-029).

---

## Scenario 8 — Race condition (SC-007)

Open two browser tabs as the same admin (or two admins). Both navigate to Test Family.

Tab A: type `1500`, preview shows Jan/Feb/Jun cascade. Save.
Tab B: type `1500`, preview shows Jan/Feb/Jun cascade. Save.

One of:
- Both succeed and one skips months already paid by the other (FR-023 → 6 docs total, no duplicate months).
- One fails with a transaction-retry error surfaced to the admin; the other succeeds (6 docs total).

**Verify**: query `payments` where `month IN (2026-01, 2026-02, 2026-06)` → at most 1 doc per month.

---

## Scenario 9 — No contribution target (edge case)

1. Edit Test Family → set `contributionTarget = 0`.
2. Record a payment of `1000`. Preview shows: **"No contribution target set on this family — spillover disabled"**, with over-limit indicator showing `1000`.
3. Save → only the current-month doc at `amount = 1000` is created. `moneyOnHand` up by `1000`. No cascade docs.

---

## Verification checklist

After running all scenarios, verify:

- [ ] `pnpm test` passes (unit + atomicity + cascade tests added)
- [ ] `pnpm typecheck` passes (no `any` leaks)
- [ ] `pnpm lint` passes
- [ ] No new fields appear on existing (pre-feature) payment docs
- [ ] Legacy single-payment flow still works end-to-end
- [ ] Firestore rules in emulator reject malformed `coverageGroupId` (UUID format enforced)