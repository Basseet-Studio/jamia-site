# Feature Specification: Payment Contribution Spillover

**Feature Branch**: `003-payment-spillover`
**Created**: 2026-06-17
**Status**: Draft
**Input**: User description: "add payemnt contributooin spill over if payemtn is over lmits show like a thing that says ur over limit by x if have back month were they are not covered , -> show user that they will go to cover that moneth to the bacl month shows paied linked to payemnt with the current date sounds complicated but should be doable also if sa payemtn is too much and all months since family is added all months are paied u can tick as fuctre payemnt so they fill for future montsh for the person"

## Summary

When an admin records a payment that exceeds the family's monthly `contributionTarget`, the system must show an "over limit by X" indicator and offer to **cascade** the excess to **unpaid back months** (oldest first) and, optionally, **future months** (next month onward) — all in a single admin entry. Each cascaded payment is recorded as its own payment doc, but linked to the original entry via a shared `coverageGroupId` and stamped with the admin's original `date`. The behavior is opt-out for back months (default: cascade) and opt-in for future months (default: do not cascade; admin must tick a checkbox).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Over-limit warning while entering a payment (Priority: P1)

**As an** admin recording a payment,
**I want to** see a clear "you are over limit by X" indicator as I type the amount,
**so that** I immediately understand when my entry exceeds the family's monthly target.

**Why this priority**: This is the entry point — without the indicator, the admin has no signal that spillover applies. Every other story depends on this one being visible first.

**Independent Test**: Open the Record Payment dialog for a family whose `contributionTarget` is 500. Type `300` → no over-limit shown. Type `600` → "Over limit by 100" appears. Type `500` exactly → no over-limit. Closes on dialog cancel. Delivers immediate, accurate feedback on the entry.

**Acceptance Scenarios**:
1. **Given** a family with `contributionTarget = 500`, **When** admin types `600` in the amount field, **Then** the dialog shows "Over limit by 100" with the current month label.
2. **Given** the amount field is `500` exactly, **When** admin views the dialog, **Then** no over-limit indicator is shown.
3. **Given** the amount field is `300`, **When** admin views the dialog, **Then** no over-limit indicator is shown and no spillover section appears.
4. **Given** the over-limit indicator is showing, **When** admin reduces the amount below `contributionTarget`, **Then** the indicator disappears within the same render.

---

### User Story 2 — Auto-cascade excess to unpaid back months (Priority: P1)

**As an** admin recording an over-limit payment,
**I want the** excess to automatically fill the oldest unpaid back months first,
**so that** I don't have to enter one payment per covered month and the family catches up automatically.

**Why this priority**: This is the core spillover behavior. Without it, the feature is just a warning. It's what makes the feature deliver value.

**Independent Test**: Family `contributionTarget = 500`, created 2026-01. No payments exist. Admin records `1500` dated 2026-06-17. Verify three payment docs are created: current month `2026-06` (amount 500) plus back months `2026-01` and `2026-02` (oldest-first, each amount 500). All three share one `coverageGroupId` and all have `date = 2026-06-17`.

**Acceptance Scenarios**:
1. **Given** a family with `contributionTarget = 500`, created `2026-01`, and no payments exist, **When** admin records `1500` for `2026-06`, **Then** the system creates 3 payment docs covering `2026-06` (current), `2026-01` (oldest unpaid back month, filled first), and `2026-02` (next oldest). Excess `1000` fills exactly 2 back months at `500` each. No doc for `2026-03`–`2026-05` (no more excess).
2. **Given** a family with `contributionTarget = 500`, **When** admin records `1700` for the current month, **Then** 1 current-month doc (`amount = 500`) plus 2 back-month docs (oldest unpaid first, each `amount = 500`) are created; **and** the remaining `200` over-limit is shown on the current month (the current-month doc still records `amount = 500`, with the `200` leftover summarised in the dialog preview but not applied to any extra month).
3. **Given** a family with `contributionTarget = 500` and `Jan`, `Feb`, `Mar` are paid, **When** admin records `1000` for `2026-06`, **Then** cascade skips `Jan/Feb/Mar` (already paid), back-month fill starts at `Apr`, fills `Apr + May` (2 docs at `500` each), plus current-month doc — total 3 docs, no leftover.
4. **Given** all back months AND current month are paid, **When** admin records `600`, **Then** no back-month docs are created (cascade has nothing to fill); over-limit of `100` is shown but no back-month row in the preview.
5. **Given** the cascade creates N payment docs, **Then** every doc in the cascade has the **same** `coverageGroupId`, the **same** `recordedAt` (or within the same server transaction), the **same** `recordedBy`, and `date` equal to the admin's entered date (NOT the covered month).

---

### User Story 3 — Coverage preview before submit (Priority: P2)

**As an** admin about to submit an over-limit payment,
**I want to** see a preview listing exactly which months will be marked paid and how much remains over-limit on the current month,
**so that** I can confirm the cascade matches my intent before committing.

**Why this priority**: Trust-builder. Without it, admins fear surprises in their ledger. Slightly less critical than the cascade itself (P1).

**Independent Test**: Same setup as Story 2 test. Before clicking Save, the dialog shows a preview block: "This payment will cover: **June 2026 (current)**, **May 2026**, **April 2026** — 3 months at 500 each = 1500 total." Click Save → cascade matches preview exactly.

**Acceptance Scenarios**:
1. **Given** a payment amount that triggers a 3-month cascade, **When** the admin views the dialog, **Then** a preview section lists the 3 months in cascade order (current first, then oldest-to-newest back months) with `amount` per month and a total.
2. **Given** the preview is showing, **When** admin changes the amount, **Then** the preview re-computes within the same render (no submit needed).
3. **Given** the cascade ends with leftover over-limit on current month, **When** the preview renders, **Then** a line "Remaining over-limit on June 2026: 200" is shown so the admin sees the unallocated amount.
4. **Given** the preview shows 0 back months, **Then** the preview section is hidden (over-limit indicator still shows, but no "will cover" list).

---

### User Story 4 — Opt-in future-month cascade when back is fully paid (Priority: P2)

**As an** admin who has over-paid and all back months are already covered,
**I want to** tick a checkbox to apply the remaining excess to **future months** for this family,
**so that** the family's contribution is pre-paid for upcoming months without me having to enter each one later.

**Why this priority**: Common follow-on case (annual lump sum payments), but explicit opt-in because it's semantically different (pre-payment vs catch-up). Important but secondary to back-month cascade.

**Independent Test**: Family `contributionTarget = 500`, created `2026-01`, all months Jan–Jun 2026 are paid. Admin records `1500` dated `2026-06-17`, ticks "Apply excess to future months". Verify: 1 doc for `2026-06` (current, amount = 500, over-limit `1000`), 1 doc for `2026-07` (future, amount = 500), 1 doc for `2026-08` (future, amount = 500). Total 3 docs, all sharing one `coverageGroupId`. If admin does NOT tick the checkbox, verify only the current-month doc is created and `1000` over-limit is recorded only in the preview (no future-month docs).

**Acceptance Scenarios**:
1. **Given** all months from `family.createdAt` month through current month are paid, **When** admin records an over-limit amount, **Then** the dialog shows a checkbox "Apply excess to future months" (unchecked by default).
2. **Given** the future-months checkbox is checked, **When** admin submits, **Then** the system creates future-month docs starting from the month **after** the payment date's month, oldest-first, each at `contributionTarget`, until the excess runs out.
3. **Given** the future-months checkbox is unchecked, **When** admin submits, **Then** no future-month docs are created; only the current-month doc.
4. **Given** the future-months cascade reaches a month that already has a payment (e.g., admin pre-paid August), **Then** that month is **skipped** (no double-pay) and the cascade continues to the next unpaid future month.
5. **Given** back months are unpaid (back cascade would fire), **When** the dialog renders, **Then** the future-months checkbox is hidden (back cascade takes priority; future cascade only applies when back is fully clear).
6. **Given** the family was created `2026-06` and this is the very first payment, **When** admin records `1000` with future-months ticked, **Then** docs cover `2026-06` (current, 500), `2026-07` (future, 500); no back-month docs because none exist.

---

### User Story 5 — Delete coverage group as one unit (Priority: P3)

**As an** admin who entered a cascade by mistake,
**I want to** delete the entire coverage group with a single confirmation,
**so that** I don't have to find and delete each cascaded payment doc separately.

**Why this priority**: Recovery flow — important but rare. The harder write-path (Story 2) is the P1 win; delete is P3 cleanup.

**Independent Test**: After Story 2 test, click delete on the current-month payment doc. Confirm dialog reads "This will also remove [N] cascaded payments in this coverage group. Continue?". Confirm → all 3 docs deleted, MOH decremented by 1500 in one transaction.

**Acceptance Scenarios**:
1. **Given** a coverage group with 3 payment docs, **When** admin clicks delete on any one of them, **Then** the confirmation dialog lists the other 2 docs by month and asks for confirmation.
2. **Given** admin confirms the group delete, **When** the operation runs, **Then** all 3 payment docs are deleted in one transaction and MOH is decremented by the total group sum (matches SC-009 atomicity guarantee).
3. **Given** admin cancels the group delete, **Then** no docs are removed and no MOH change occurs.
4. **Given** a payment doc with no `coverageGroupId` (legacy or solo payment), **When** admin clicks delete, **Then** the existing single-doc delete flow runs (no group prompt).

### Edge Cases

- **Partial fill**: If `excess < contributionTarget` and the first unpaid back month exists, no back-month docs are created (whole-month rule). Excess stays as over-limit on the current month and the preview shows "No full back month to cover with the remaining over-limit of X".
- **`contributionTarget = 0`**: No cascade can occur (zero target means nothing to fill). Over-limit indicator still shows; preview shows "No contribution target set on this family — spillover disabled".
- **Legacy family with no `createdAt`**: Use the oldest existing payment month (or current month if none) as the cascade start point for back months. Future months still begin from next month.
- **Family created in a future month (data error)**: Clamp back-month start to current month; do not attempt to back-fill future months.
- **Future-month tick with no `createdAt`**: Future cascade starts from next month after the payment date's month, identical to normal case.
- **Currency mismatch**: Payment doc uses the household's `currency` setting — already handled by existing `recordPayment` flow; cascade inherits.
- **Race condition on double-cascade**: If two admins submit overlapping cascades for the same family simultaneously, the second cascade must re-evaluate after commit (Firestore transaction re-reads payment docs inside the txn) and skip any month already paid by the first cascade. Months already covered by a parallel commit must NOT be double-paid.
- **Cancelled dialog after preview shown**: No payment docs created, no MOH change. The preview is purely client-side until submit.
- **Coverage group ID collision**: Use a v4 UUID generated client-side at submit time. No collision risk for the stated scale.
- **Admin edits `contributionTarget` after cascade**: Already-paid months stay paid; future cascades use the new target. No retroactive adjustment to existing payment docs.

## Requirements *(mandatory)*

### Functional Requirements

#### Over-limit indicator

- **FR-001**: System MUST compute the **current month expected contribution** = `family.contributionTarget` (read live; reacts to family edits).
- **FR-002**: While the Record Payment dialog is open, the system MUST show a live indicator reading **"Over limit by X"** when `enteredAmount > contributionTarget`, where `X = enteredAmount − contributionTarget` rendered in the household `currency`.
- **FR-003**: When `enteredAmount <= contributionTarget`, the indicator MUST be hidden.
- **FR-004**: The indicator MUST update reactively as the admin edits the amount field (no debounce > 100ms required; standard controlled input is sufficient).

#### Back-month cascade (auto)

- **FR-005**: When the submitted payment has `amount > contributionTarget`, the system MUST compute the **excess** = `amount − contributionTarget`.
- **FR-006**: The system MUST identify **unpaid back months** for the family: months from `max(family.createdAt month, oldestPaymentMonth+1)` through the month before the payment's `date` month, excluding any month that already has at least one payment.
- **FR-007**: Unpaid back months MUST be processed in **oldest-first order** (chronological ascending).
- **FR-008**: For each unpaid back month in order, the system MUST create a payment doc with `amount = contributionTarget`, deduct that from `excess`, and continue while `excess >= contributionTarget`. If `excess < contributionTarget` at any point, the loop terminates and the remainder stays as over-limit on the current-month doc.
- **FR-009**: When `excess == 0` after creating the current-month doc, no back-month docs are created.

#### Future-month cascade (opt-in)

- **FR-010**: When **all** months in `[family.createdAt month … paymentDate month]` are paid, AND the future-months checkbox is ticked, the system MUST compute **future unpaid months**: months after `paymentDate` month, excluding any month with at least one payment.
- **FR-011**: Future unpaid months MUST be processed in **oldest-first order**.
- **FR-012**: For each future unpaid month, the system MUST create a payment doc with `amount = contributionTarget` until `excess < contributionTarget`.
- **FR-013**: The future-months checkbox MUST be **unchecked by default** and MUST be hidden whenever back-month cascade would fire (i.e., when any unpaid back month exists).

#### Coverage group linking

- **FR-014**: All payment docs created from a single admin submission (current + back + future) MUST share a single `coverageGroupId` (UUID v4 string, generated client-side at submit).
- **FR-015**: Every doc in a coverage group MUST have the **same** `date` field (the admin-entered date), the **same** `recordedBy` UID, and `recordedAt` set within the same transaction.
- **FR-016**: Each cascaded doc MUST have its own `month` field reflecting the **month it covers** (NOT the original `date` month). The original-date month is the **current-month doc** in the group; all other docs use their own covered month.

#### Coverage preview

- **FR-017**: Before submit, the dialog MUST render a **preview section** showing the list of months to be covered, in cascade order (current first, then back months oldest-to-newest, then future months oldest-to-newest if applicable), with `amount` per month and the total.
- **FR-018**: If the cascade leaves a non-zero remainder on the current month, the preview MUST show "Remaining over-limit on [month]: X".
- **FR-019**: The preview MUST re-compute on every keystroke / amount change.
- **FR-020**: When no cascade is triggered (no back months, no future tick), the preview section MUST be hidden (over-limit indicator may still show).

#### Submit semantics

- **FR-021**: On submit, the system MUST create all payment docs in a single Firestore transaction (one `runTransaction` call), preserving the **SC-009 atomicity guarantee** — payment writes and MOH shifts commit together.
- **FR-022**: The MOH shift MUST equal the **sum of all amounts in the coverage group** (not just the current-month doc).
- **FR-023**: The transaction MUST re-verify (inside the txn) that no back/future month picked for cascade has been paid by a concurrent admin, skipping any that have. If any month in the planned cascade was paid in parallel, the cascade for that month is skipped and excess is consumed by the next applicable month (or stays as over-limit).
- **FR-024**: If the transaction fails, no docs are created and no MOH change occurs (existing rollback semantics).

#### Delete semantics

- **FR-025**: When admin clicks delete on a payment doc with a `coverageGroupId`, the system MUST show a confirmation reading "This will also remove N cascaded payment(s) in this coverage group. Continue?".
- **FR-026**: On confirm, all docs in the group MUST be deleted in one transaction and MOH decremented by the group sum (atomic).
- **FR-027**: On cancel, no change occurs.
- **FR-028**: Payment docs without a `coverageGroupId` MUST use the existing single-doc delete flow unchanged.

#### Backward compatibility

- **FR-029**: Existing payment docs (no `coverageGroupId` field) MUST continue to display correctly in the payment history table and the new delete flow MUST skip the group prompt for them.
- **FR-030**: The new `coverageGroupId` field MUST be optional (nullable) in the payment schema; legacy docs read with `coverageGroupId = null`.

### Key Entities *(include if feature involves data)*

- **Payment** (modified): adds optional `coverageGroupId: string | null` — links sibling payment docs created from one admin submission. All other fields unchanged from v1.
- **CoverageGroup** (derived, NOT stored): the set of payment docs sharing one `coverageGroupId`. Used only to power the delete-confirmation flow and the preview. Exists only as a query (`where("coverageGroupId", "==", id)`).
- **MonthCoverage** (derived, NOT stored): for a given family and month, `paid = (exists payment where month == M)`. Used to compute the unpaid back / future month lists. Already implicit in existing code (sum of payments per month).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can record a single entry that covers the current month plus N unpaid months, completing the action in **one** dialog interaction (no manual back-fill per month). Verified by recording a 3-month cascade and counting one submission click.
- **SC-002**: 100% of cascaded payment docs from a single submission share the same `coverageGroupId`. Verified by querying the family's payments sub-collection after submit.
- **SC-003**: All cascaded docs reflect the admin-entered `date` (not the covered month's date). Verified by inspecting each doc's `date` field after a cascade.
- **SC-004**: Deleting any one doc in a coverage group removes all docs in the group and decrements MOH by the group total in **one** transaction (no partial deletes observed on retry).
- **SC-005**: The over-limit indicator updates within 100ms of the amount field changing (controlled input, no debounce).
- **SC-006**: The coverage preview accurately reflects the post-submit state in 100% of test cases (preview lists exactly the months that get created).
- **SC-007**: No month is double-paid by concurrent cascades — verified by a simulated parallel submit test where two cascades overlap on the same unpaid back month and exactly one wins that month.
- **SC-008**: Existing single-payment flows (no over-limit, no cascade) continue to work unchanged — verified by running the existing `payments.test.ts` suite with zero changes.

## Assumptions

- **Single-currency**: All payment amounts are in the household's `currency` (no conversion). Inherited from v1.
- **`contributionTarget` is the monthly target**: Already enforced in v1 — assumed unchanged.
- **Whole-month cascade**: Excess that is less than `contributionTarget` cannot partially fill a back month; it stays as over-limit on the current month. This is the simplest defensible rule and matches "show user that they will go to cover that month to the back month" (whole months, not fractional).
- **Future-month opt-in default**: Future cascade is off by default to avoid surprising admins who intend only back-fill. The checkbox is the explicit signal.
- **No retroactive coverage re-balancing**: If `contributionTarget` changes after a cascade, already-paid months stay paid; only future cascades use the new target. No refund / clawback logic.
- **`family.createdAt` is the cascade start**: For families with `createdAt`, the cascade starts at that month. Legacy families with no `createdAt` use the oldest payment month + 1 as the back-month start.
- **Date format**: Admin-entered date is a JS `Date` object via the existing date picker. Covered-month derivation uses `toMonthKey(date)` already present in `src/lib/utils/dates.ts`.
- **UUID generation**: Client-generated v4 UUID via the `crypto.randomUUID()` browser API (available in all evergreen browsers since 2022; safe in the project's target environment).
- **Existing payment schema is the floor**: `coverageGroupId` is an additive field. No field removal, no type change, no index rename.
- **MOH shift atomicity per group**: The existing `shiftMoneyOnHandInTx` is called once per group with the **total** amount, not once per doc. This matches v1's batched-write model and SC-009.
- **The "back months" UX text is the spec wording**: The exact phrasing ("Over limit by", "Apply excess to future months", etc.) is owned by the i18n layer and is not specified here — implementers add `// TODO: localise` markers and reuse the `useT()` hook.