# Data Model: Payment Contribution Spillover

**Branch**: `003-payment-spillover` | **Date**: 2026-06-17
**Source**: `spec.md` Key Entities + FR-001 to FR-030
**Extends**: `specs/002-members-expenses-calendar/data-model.md` (v1 + 002 entity shape)

Defines the new field on `Payment`, the derived `CoveragePlan` / `CoverageGroup` types, validation rules, and the only Firestore index delta. The shape is locked in `contracts/firestore.rules` (delta) and implemented in `src/lib/services/coverage.ts` + edits to `src/lib/services/payments.ts`.

---

## 1. Payment (modified)

**Path**: `households/{householdId}/families/{familyId}/payments/{paymentId}`

Inherits v1 fields. New field:

| Field | Type | Required | Notes |
|---|---|---|---|
| `coverageGroupId` | string \| null | no (additive; default null on legacy) | UUID v4 string linking sibling docs created from a single admin submission. Absent on legacy single payments. |

**Validation** (Zod schema in `src/lib/schemas/payment.ts`):
- `coverageGroupId`: optional. When present, MUST match `z.string().uuid()`.
- Re-validation in the service layer (per v1 invariant) — the schema runs before Firestore write, so malformed IDs are rejected at the client edge AND in the service guard.

**Type adapter** (in `src/lib/services/payments.ts` `toPayment`):
```ts
coverageGroupId:
  typeof data.coverageGroupId === "string"
    ? (data.coverageGroupId as string)
    : null,
```
Mirrors the v1 `note: (data.note as Payment["note"]) ?? null` pattern at L41.

**Type interface** (`src/lib/types/index.ts`):
```ts
export interface Payment {
  // ... v1 fields ...
  coverageGroupId: string | null; // 003 — null for legacy single payments
}
```

**Firestore rule surface** (no rule changes needed):
The v1 create rule at `firestore.rules` L151-157 only constrains `recordedBy`, `recordedAt`, `amount`, `month`. The new `coverageGroupId` field is not gated; if the admin writes one, it persists as-is.

**Update permission**: still `if false` per v1 — no `updatePayment` exists. Coverage-group edits are not supported in v1 (per FR-015 + spec Edge Cases).

---

## 2. CoveragePlan (derived, NOT stored — pure function output)

**Path**: N/A — computed by `planCoverage()` in `src/lib/services/coverage.ts`.

| Field | Type | Notes |
|---|---|---|
| `coverageGroupId` | string | The UUID assigned to this submission (generated at plan time, re-used by the submit service). |
| `currentMonth` | `MonthSlot \| null` | The slot covering the payment's `date` month. Null only if the family has no `contributionTarget`. |
| `backMonths` | `MonthSlot[]` | Ordered oldest-first. Empty when no unpaid back months exist OR when target is 0. |
| `futureMonths` | `MonthSlot[]` | Ordered oldest-first. Empty when future-months checkbox is off OR when back cascade has nothing to spill into. |
| `totalAmount` | number | `sum(slot.amount for slot in [currentMonth, ...backMonths, ...futureMonths])`. Equal to the admin's entered amount when no over-limit remainder; otherwise `< amount`. |
| `overLimitRemainder` | number | `enteredAmount − totalAmount`. Non-negative. Stays un-allocated when remainder < `contributionTarget`. |

**Supporting types**:
```ts
export interface MonthSlot {
  month: string;          // "YYYY-MM"
  amount: number;         // always === family.contributionTarget in v1
}

export interface CoveragePlan {
  coverageGroupId: string;
  currentMonth: MonthSlot | null;
  backMonths: MonthSlot[];
  futureMonths: MonthSlot[];
  totalAmount: number;
  overLimitRemainder: number;
}
```

**Inputs** (`planCoverage` parameters):
```ts
planCoverage(args: {
  amount: number;             // admin's entered amount, > 0
  date: Date;                 // admin's entered date
  family: { contributionTarget: number; createdAt: Date | null };
  payments: Payment[];        // existing payments for the family (any months)
  applyToFutureMonths: boolean; // dialog checkbox state
}): CoveragePlan
```

**Algorithm** (mirrors FR-005..FR-013):

```
1. target = family.contributionTarget
2. If target <= 0: return empty plan with overLimitRemainder = amount, no slots
3. coverageGroupId = crypto.randomUUID()
4. currentMonthKey = toMonthKey(date)
5. excess = max(0, amount - target)

6. currentMonth = { month: currentMonthKey, amount: target }

7. backMonths = []
   If excess > 0 AND target > 0:
     paidSet = Set(payments.map(p => p.month))
     startMonth = max(
       family.createdAt ? toMonthKey(family.createdAt) : null,
       oldestPaymentMonth(payments) ?? null
     )
     For m = startMonth; m < currentMonthKey; stepMonthKey(m, +1):
       If paidSet.has(m): skip
       If excess < target: stop (whole-month rule)
       backMonths.push({ month: m, amount: target })
       excess -= target

8. futureMonths = []
   If applyToFutureMonths AND excess > 0 AND backMonths is empty (and no unpaid back exists):
     paidSet = Set(payments.map(p => p.month))
     For m = stepMonthKey(currentMonthKey, +1); excess >= target; stepMonthKey(m, +1):
       If paidSet.has(m): skip
       futureMonths.push({ month: m, amount: target })
       excess -= target

9. totalAmount = (currentMonth?.amount ?? 0) + sum(backMonths.amount) + sum(futureMonths.amount)
10. overLimitRemainder = amount - totalAmount
11. return CoveragePlan { ... }
```

**Edge cases handled**:
- `target = 0` → no slots; overLimitRemainder = amount (FR rule + spec edge case)
- `family.createdAt = null` (legacy) → start = oldestPaymentMonth + 1, or current month if no payments
- `family.createdAt > currentMonthKey` (data error) → backMonths loop never runs (start > end)
- `excess < target` while back cascade in progress → loop stops; remainder stays on current month
- Race scenario: input `payments` includes a would-be cascade month → that month is filtered out via `paidSet`

---

## 3. CoverageGroup (derived, NOT stored)

**Path**: N/A — exists only as a query: `where("coverageGroupId", "==", groupId)` against the `payments` collection-group.

| Field | Type | Notes |
|---|---|---|
| `id` | string | The `coverageGroupId`. |
| `members` | `Payment[]` | All payment docs sharing this ID. Typically 1-10 docs. |
| `totalAmount` | number | `sum(members.amount)`. Used by the delete-coverage-group flow to compute the MOH decrement. |

Used by:
- `RecordPaymentDialog` confirmation flow → reads member count for "This will also remove N cascaded payment(s)" message
- `DeletePaymentDialog` group delete → reads members inside the txn for atomic delete + MOH shift

---

## 4. CascadedPaymentWrite (internal, transaction-local)

**Path**: N/A — transient struct constructed inside `recordPaymentWithCoverage()`'s `runTransaction`.

```ts
interface CascadedPaymentWrite {
  ref: DocumentReference;       // pre-created doc(collection(...)) ref
  month: string;                // month this slot covers
  amount: number;               // always target
  coverageGroupId: string;      // shared across all writes in the group
  date: Date;                   // admin-entered date, shared across all docs
  note: string | null;
  recordedBy: string;           // uid, shared across all docs
}
```

The transaction iterates `CascadedPaymentWrite[]` and calls `tx.set(ref, { ...same shape as v1 recordPayment payload plus coverageGroupId })` for each. After all sets, `shiftMoneyOnHandInTx(tx, +totalAmount)` is called exactly once (Decision 9).

---

## 5. Money on hand (unchanged)

**Path**: `settings/global.moneyOnHand`

No field changes. The cascade shifts it by the **group total** in one call per submit / one call per group-delete — preserves SC-009 atomicity.

---

## 6. Hard-delete cascade (unchanged from 002)

The v1 + 002 cascade already removes all `payments/*` docs under a household. No new fields to clean — `coverageGroupId` disappears with the docs.

---

## 7. Indexes (delta)

Add ONE composite index in `firestore.indexes.json`:

```jsonc
{
  "collectionGroup": "payments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "coverageGroupId", "order": "ASCENDING" },
    { "fieldPath": "recordedAt", "order": "DESCENDING" }
  ]
}
```

Brings the total from 7 to 8 (Spark limit 200 — plenty of headroom).

Used by:
- `listPaymentsByCoverageGroup(groupId)` (new helper in `payments.ts`) — for delete-group flow
- Future "show coverage siblings" UI surfaces (out of scope for v1)

---

## 8. Validation summary (Zod schemas)

| Schema | Path | Field | Notes |
|---|---|---|---|
| `recordPaymentSchema` (extended) | `schemas/payment.ts` | `coverageGroupId?: string` | Optional. UUID format when present. |
| `recordPaymentWithCoverageSchema` (new) | `schemas/payment.ts` | `coverageGroupId: string`, `applyToFutureMonths: boolean`, `payment: RecordPaymentSchema` | Used by the dialog to submit a cascade. |

Service layer re-validates the entire schema on every write (v1 invariant).

---

## 9. State transitions summary

No new state machines. `Payment` lifecycle unchanged from v1. `CoverageGroup` is derived (no transitions). `CoveragePlan` is ephemeral (computed per submit, never stored).

| Entity | States | Transitions |
|---|---|---|
| Payment | (v1) — created, never updated, deleted | Unchanged |
| CoverageGroup | (derived) — present or absent per payment | n/a |
| CoveragePlan | (ephemeral) — computed at submit time | n/a |

---

## 10. Service surface (delta)

| Function | Path | Purpose |
|---|---|---|
| `planCoverage(args)` | `services/coverage.ts` (new) | Pure function. Returns `CoveragePlan`. |
| `recordPaymentWithCoverage(uid, args)` | `services/payments.ts` (new) | Orchestrates the cascade. Wraps `runTransaction`, calls `planCoverage` inside the txn, writes all docs, shifts MOH once. |
| `deletePayment(uid, hh, fam, pid)` | `services/payments.ts` (modified) | Detects `coverageGroupId`; routes to single-doc or group-delete path. |
| `listPaymentsByCoverageGroup(hh, fam, cgid)` | `services/payments.ts` (new) | Returns sibling docs. Used by the delete-group confirmation dialog to render the list of months that will be removed. |

The original `recordPayment` (no cascade) stays exported for any caller that explicitly wants the single-doc path — but the dialog calls `recordPaymentWithCoverage` exclusively in v1.