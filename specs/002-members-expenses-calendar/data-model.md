# Data Model: Household Members, Expense Types, Calendar View, and Budget Shortfall Warnings

**Branch**: `002-members-expenses-calendar` | **Date**: 2026-06-10
**Source**: `spec.md` Key Entities (L180-186) + FR-001 to FR-032
**Extends**: `specs/001-household-finance-dashboard/data-model.md`

Defines every new and modified entity, fields, types, validation rules, state transitions, and derived values. The Firestore shape is locked in `contracts/firestore.rules` (delta) and implemented in `src/lib/services/`.

---

## 1. Household (modified)

**Path**: `households/{householdId}`

Inherits v1 fields. New fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `memberCount` | number | yes (after v1+1 migration; nullable on legacy docs) | non-negative integer; UI saves `memberNames.length` |
| `memberNames` | string[] | yes (nullable on legacy docs) | JSON array; each 1-80 chars trimmed; order preserved |
| `updatedAt` | Timestamp \| null | yes | set on every member edit; null on legacy |
| `updatedBy` | string (UID) \| null | yes | admin who last edited members; null on legacy |

**Validation** (Zod schema in `src/lib/schemas/household.ts`):
- `memberCount`: integer >= 0
- `memberNames`: array of strings, each `trim().min(1).max(80)`
- Invariant enforced in service: `memberCount === memberNames.length` (rejected if not — see FR-003)
- Member-name uniqueness is NOT required (different families can share a first name; spec edge case L114)

**Update permission** (rules delta):
- Allow `update` iff `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount', 'memberNames', 'updatedAt', 'updatedBy'])`
- This is the ONLY allowed household update. All other edits (e.g. `name`) are still blocked.

**Lifecycle** (inherits v1 hard-delete cascade, extended):
- Hard delete now also cascades to:
  - All docs in `households/{hhId}/memberHistory/*` (FR-007)
  - All `expenses` docs where `type === "household" AND householdId === hhId` (FR-015)
- Cascade remains chunked at 500 ops per batch (Firestore limit).

**Migration**: legacy households (no `memberCount` field) read with `memberCount = 0` and `memberNames = []`. The first member edit writes the new shape.

---

## 2. HouseholdMemberHistory (new)

**Path**: `households/{householdId}/memberHistory/{historyId}`

| Field | Type | Required | Notes |
|---|---|---|---|
| `previousCount` | number | yes | count before this edit |
| `previousNames` | string[] | yes | names before this edit (JSON array) |
| `newCount` | number | yes | count after this edit |
| `newNames` | string[] | yes | names after this edit |
| `changedAt` | Timestamp | yes | server timestamp of the write |
| `changedBy` | string (UID) | yes | admin who made the change |

**Validation** (Zod schema in `src/lib/schemas/memberHistory.ts`):
- All four history fields: same rules as the household `memberCount` / `memberNames`
- `changedBy`: non-empty string
- The history record MUST reflect a real change (if `previousCount === newCount` AND `previousNames === newNames`, the service layer still writes the record so even no-op edits are logged — spec edge case L115)

**Lifecycle**:
- **Append-only**. No `updateMemberHistory` / `deleteMemberHistory` methods in the service layer.
- `firestore.rules`: `allow update, delete: if false` on this sub-collection.
- Read newest-first via `orderBy("changedAt", "desc")`.
- Created atomically in the same batched write as the household update (see `updateMembers` in `households.ts`).

**Invariant (FR-005)**: a household with N edits has exactly N history records. Verified by tests counting records after a sequence of edits.

---

## 3. Expense (modified)

**Path**: `expenses/{expenseId}`

Inherits v1 fields. New fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"household" \| "mosque"` | yes | literal tag for the discriminated union |
| `householdId` | string \| null | conditional | required when `type === "household"`; must be null otherwise |
| `familyId` | string \| null | conditional | optional when `type === "household"`; if set, must belong to the same `householdId`; must be null otherwise |
| `mosqueSubCategory` | `"maintenance" \| "salary" \| "other" \| null` | conditional | required when `type === "mosque"`; must be null otherwise |

**Validation** (Zod `discriminatedUnion` in `src/lib/schemas/expense.ts`):

```ts
const householdExpense = z.object({
  ...base,
  type: z.literal("household"),
  householdId: z.string().min(1),
  familyId: z.string().nullable().optional(),
  mosqueSubCategory: z.null(),
});

const mosqueExpense = z.object({
  ...base,
  type: z.literal("mosque"),
  householdId: z.null(),
  familyId: z.null(),
  mosqueSubCategory: z.enum(["maintenance", "salary", "other"]),
});

export const createExpenseSchema = z.discriminatedUnion("type", [
  householdExpense,
  mosqueExpense,
]);
```

**Update permission** (rules delta):
- The v1 withdraw transition is still the ONLY allowed `update` (other fields immutable on withdraw).
- The rule's field-equality list grows to include the new fields (`type`, `householdId`, `familyId`, `mosqueSubCategory`) — they must equal `resource.data.*` to permit the withdraw.
- No `update` is allowed for any other purpose. Type changes are NOT supported (delete + recreate).

**Lifecycle**: inherits v1 state machine.

**Filter / list**:
- `listExpenses(month, filters?)` accepts an optional `{ type?, mosqueSubCategory? }` filter. When both `type` and `mosqueSubCategory` are set, the query is `where("type", "==", "mosque").where("mosqueSubCategory", "==", X).where("month", "==", M)` — a 3-field query that may require a new composite index (see §8).
- The existing `subscribeExpenses(month, cb)` keeps its signature. New convenience wrappers: `subscribeHouseholdExpenses(householdId, month, cb)` and `subscribeMosqueExpenses(month, subCategory?, cb)`.

**Cascade** (FR-015): household hard delete removes every expense where `type === "household" AND householdId === hhId`. Mosque expenses survive any household delete.

---

## 4. RecurringExpenseTemplate (modified)

**Path**: `recurringExpenses/{templateId}`

Inherits v1 fields. New fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"household" \| "mosque"` | yes | default `"mosque"` on create |
| `householdId` | string \| null | conditional | required when `type === "household"`; null otherwise |
| `familyId` | string \| null | conditional | optional when `type === "household"`; null otherwise |
| `mosqueSubCategory` | `"maintenance" \| "salary" \| "other" \| null` | conditional | required when `type === "mosque"`; null otherwise |

**Validation**: same `discriminatedUnion` shape as Expense. Schema in `src/lib/schemas/recurringTemplate.ts`.

**Update permission** (rules delta):
- The v1 update rule (`createdAt/createdBy` immutable) is extended. The new fields can be updated but only in lockstep with the `type` field, and `createdAt`/`createdBy` still must not change. We do not enforce the XOR in the rule (it would double the rule surface); the Zod schema is the primary guard. The service re-validates on every update.

**Calendar view (FR-022, FR-023, FR-024)**:
- For each active template, status in the selected month is derived:
  - `NotAdded` — no `expenses` doc with `recurringId === template.id AND month === selectedMonth`
  - `PendingWithdrawal` — such a doc exists and `withdrawn === false`
  - `Withdrawn` — such a doc exists and `withdrawn === true`
- "Add for this month" creates a new `expenses` doc with `isRecurring: true`, `recurringId: templateId`, the template's name/amount/type/linkage, `date: firstOfMonth`, `withdrawn: false`.

---

## 5. MonthlyBudgetShortfall (derived, NOT stored)

**Path**: N/A — computed live.

| Field | Type | Notes |
|---|---|---|
| `available` | number | `moneyOnHandAtStartOfMonth + sum(payments for M) − sum(withdrawn expenses for M)` |
| `recurringTotal` | number | `sum(recurringExpenses.amount where active)` |
| `shortfall` | number | `max(0, recurringTotal − available)` |
| `severity` | `"ok" \| "watch" \| "risk"` | `ok` if shortfall == 0; `watch` if 0 < shortfall ≤ 10% of recurringTotal; `risk` if > 10% |
| `asOf` | Timestamp | most recent `updatedAt` across the four sources |

**Formula (FR-027, FR-028)**:

```
moneyOnHandAtStartOfMonth(M) =
  settings.global.openingBalance
  + Σ payments.amount where date < firstOfMonth(M)
  − Σ expenses.amount where date < firstOfMonth(M) AND withdrawn === true

available(M) =
  moneyOnHandAtStartOfMonth(M)
  + Σ payments.amount where month === M
  − Σ expenses.amount where month === M AND withdrawn === true

recurringTotal(M) = Σ recurringExpenses.amount where active === true
shortfall(M) = max(0, recurringTotal(M) − available(M))
severity(M) =
  shortfall(M) == 0                       ? "ok"
  : shortfall(M) <= 0.10 * recurringTotal  ? "watch"
  :                                         "risk"
```

**Edge cases (handled by the pure function)**:
- Zero active templates → `recurringTotal = 0`, `shortfall = 0`, `severity = "ok"`, no banner shown.
- Exact match (`available == recurringTotal`) → `shortfall = 0`, `severity = "ok"`.
- Negative `available` → service does not throw; `shortfall` may exceed `recurringTotal`.
- 10% boundary is inclusive: `shortfall == 0.10 * recurringTotal` → `watch`; `shortfall == 0.10 * recurringTotal + ε` → `risk`. Matches FR-027 spec.

**Reactive subscription**: `subscribeMonthlyShortfall(month, cb)` opens 4 `onSnapshot` listeners (see `contracts/firestore.rules` index coverage) and re-emits on every change. Latency: < 1s in practice (sub-100ms for the stated scale).

---

## 6. CalendarView (derived, NOT stored)

**Path**: N/A — computed for a selected month from three subscriptions.

| Group | Source | Sort |
|---|---|---|
| Recurring expenses (this month) | All `recurringExpenses` (active filtered at render time) joined to expenses-by-(recurringId, month) | by template name |
| Ad-hoc expenses (this month) | `expenses` where `month === M` AND `recurringId == null` | by `date` desc |

**Status derivation per template row** (FR-022):
- One of: `NotAdded`, `PendingWithdrawal`, `Withdrawn` — see §4.
- `PendingWithdrawal` and `Withdrawn` rows show a link to the underlying expense.
- `NotAdded` rows show an "Add for this month" action (FR-024).

**Empty state (FR-026)**: when both groups are empty for the selected month, render an explicit card with the literal "No expenses scheduled or recorded for this month". The month navigator stays visible and functional.

---

## 7. Hard-delete cascade matrix (updated)

When a household is hard-deleted, the following are removed in a single (chunked) batched write (per the existing v1 cascade, extended):

| Removed | Reason |
|---|---|
| `households/{hhId}` | root |
| `households/{hhId}/families/*` | v1 cascade |
| `households/{hhId}/families/*/payments/*` | v1 cascade |
| `households/{hhId}/memberHistory/*` | FR-007 (new) |
| `expenses/*` where `type === "household" AND householdId === hhId` | FR-015 (new) |

**Not removed**: `recurringExpenses` templates that reference the deleted household (they become `householdId` orphans, but the template row itself is not a child of the household doc — it lives at the top level). Per Edge case L117, archived templates are hidden from the active list but the row persists. The plan does NOT auto-archive templates when their household is deleted; admins can manually archive via the Recurring screen. This matches "no auto-cleanup" rule from v1.

---

## 8. Indexes (delta)

The v1 `firestore.indexes.json` declares 4 composite indexes. New queries in 002 may need two more:

5. `expenses` — `type` ASC, `mosqueSubCategory` ASC, `month` ASC
   - Used by `subscribeMosqueExpenses(month, subCategory)` and the mosque sub-filter on the expenses list.

6. `expenses` — `householdId` ASC, `type` ASC, `month` ASC
   - Used by the household-detail expense scope and the household-delete cascade query.

7. `recurringExpenses` — `type` ASC, `active` ASC
   - Used by the household-detail "active household templates" view (household-scoped calendar within a household's detail page).

All other queries are covered by existing single-field equality filters (no composite index needed) or the v1 indexes.

**Spark limit**: 200 composite indexes per project. 7 total is well under.

---

## 9. State transitions summary (delta)

No new state machines. All transitions on existing entities are inherited from v1. New entity (HouseholdMemberHistory) has zero transitions (append-only).

| Entity | States | Transitions |
|---|---|---|
| Household | (v1) + `noMembers` ↔ `withMembers` | Admin: `updateMembers` (batched with history) |
| HouseholdMemberHistory | (none — append-only) | — |
| Expense | (v1) | Inherits; new fields immutable after create |
| RecurringTemplate | (v1) | Inherits; new fields mutable via `updateRecurringTemplate` |
| MonthlyBudgetShortfall | (none — derived) | — |

---

## 10. Validation summary (Zod schemas)

| Schema | Path | Discriminator | Notes |
|---|---|---|---|
| `householdMemberSchema` | `schemas/householdMember.ts` | — | `memberCount: int >= 0`, `memberNames: string[1..80]` |
| `memberHistorySchema` | `schemas/memberHistory.ts` | — | Inherits + `previousCount/Names`, `newCount/Names`, `changedBy` |
| `createExpenseSchema` | `schemas/expense.ts` | `type` | household / mosque branches |
| `createRecurringTemplateSchema` | `schemas/recurringTemplate.ts` | `type` | household / mosque branches; default `mosque` |

All schemas re-used by the form layer (via `@hookform/resolvers/zod`) AND re-validated in the service layer on every write. The form's pre-validation gives the user friendly errors; the service re-validation guards against misbehaving clients and is the one that writes to Firestore.

---

## 11. Cascade delete service signature (extended)

`deleteHousehold(uid, householdId)` from v1 is extended. The new implementation:

1. Collects:
   - All family doc refs under the household
   - All payment doc refs under each family
   - All member-history doc refs under the household
   - All expense doc refs where `type === "household" AND householdId === hhId` (collection-group query on `expenses`)
2. Builds the flat delete list
3. Commits in chunks of 500 (Firestore batch limit)
4. The household doc delete is in the FIRST chunk (so a partial failure leaves a household with no children but still in the DB; admin can retry — atomicity is best-effort within a single batch).

Idempotency: a re-run finds no children (household already gone) and deletes nothing. Safe to retry.
