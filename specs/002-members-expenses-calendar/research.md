# Research: Household Members, Expense Types, Calendar View, and Budget Shortfall Warnings

**Branch**: `002-members-expenses-calendar` | **Date**: 2026-06-10

Resolves all `NEEDS CLARIFICATION` items from `plan.md` Technical Context. Each decision follows the format **Decision / Rationale / Alternatives considered**.

This feature extends the v1 dashboard shipped in `001-household-finance-dashboard`. The stack, repo conventions, and most patterns are inherited from v1. The research below only covers what is new or changed in 002.

---

## 1. Member history storage shape

**Decision**: Append-only sub-collection `households/{householdId}/memberHistory/{historyId}` — a sibling of the `families` sub-collection, not a sub-document of Family and not a top-level collection.

**Rationale**:
- Spec assumption L201 is explicit: "sibling of the families sub-collection" — chosen to keep the history inside the household's security-rule boundary (only an admin acting on that household can read/write its history) without coupling the history lifecycle to any family.
- Append-only is enforced in the service layer (no `update`/`delete` methods on `memberHistory`) and re-asserted in `firestore.rules` (`allow update, delete: if false`).
- Per-household sub-collection keeps the read fan-out tiny: history view for a household reads at most tens of docs (one per edit), well under the Spark quota.
- Hard delete on the household already cascades in chunked batches; we extend that cascade to include the `memberHistory` sub-collection, satisfying FR-007 and Edge case L29.

**Alternatives considered**:
- Top-level `householdMemberHistory` collection with `{householdId, ...}` denormalised: needs duplicate security rules for the new collection, and `householdId` lookups add an index. Rejected — sub-collection is simpler and matches the spec assumption.
- Sub-document of the household doc: capped at 1 MiB; history would eventually break. Rejected.
- Sub-document of each Family: not all households have families; spec is clear the history is per-household. Rejected.

---

## 2. Expense `type` field — `household` vs `mosque`

**Decision**: Add a required `type` field to every expense document, with literal value `"household" | "mosque"`. The validation is a Zod `discriminatedUnion("type", [...])` so the cross-field rules (e.g. `mosque` MUST have no `householdId` and MUST have `mosqueSubCategory`) are encoded in the schema, not scattered across the service layer.

**Rationale**:
- `z.discriminatedUnion` (per Zod docs) lets the parser pick the right shape based on `type` and report friendly, branch-specific errors — better than a hand-rolled `superRefine` and faster than `z.union`.
- The same Zod schema is used by the form (via `@hookform/resolvers/zod`) and by the service layer (re-parses on every write). This keeps "type XOR linkage" as a single source of truth, matching the v1 pattern.
- `firestore.rules` re-asserts the cross-field rules with a `request.resource.data.type` branch so even a misbehaving client cannot persist an illegal shape.

**Alternatives considered**:
- Single object schema + `superRefine` for cross-field checks: works but loses the friendly per-branch error messages; rule branching in `firestore.rules` would still be needed. Rejected.
- Two separate `household_expenses` and `mosque_expenses` collections: doubles the security rules surface, breaks the "expenses list" / "calendar" queries that already span both types, and inflates index count. Rejected.

---

## 3. Expense cascade on household hard delete

**Decision**: `expenses` is a top-level collection. A `type: "household"` expense is linked by `householdId` (and optionally `familyId`). On household hard delete, the existing chunked-batch cascade in `households.deleteHousehold` is extended to ALSO delete every expense where `type == "household" AND householdId == deletedId`. Mosque expenses are untouched.

**Rationale**:
- Edge case L116 / FR-015: "an expense with `type: \"household\"` is always tied to exactly one household" — so a collection-group query keyed on `householdId == X AND type == "household"` is enough to find the orphans.
- Mosque expenses are intentionally NOT cascaded — a mosque salary expense outlives any single household. This matches FR-015.
- The collection-group query is indexed via the same `householdId` field that already exists on household-scoped payments. Adding a single-field equality filter on `type` is a free query in Firestore (no new composite index required for a single `where`).
- Cascade chunks remain at 500 ops per batch (Firestore limit), so very large household deletes stay within quota.

**Alternatives considered**:
- Moving household-scoped expenses into a `households/{hhId}/expenses` sub-collection: would require reworking the existing `expenses` collection and every query that reads it. Rejected — out of scope for this feature.
- Tombstoning expenses instead of cascade-deleting: the spec assumption L207 picks cascade, matching the existing v1 cascade pattern. Rejected.

---

## 4. Budget shortfall service — live computation

**Decision**: Pure derived computation. A new `BudgetShortfallService` exposes:
- `computeMonthlyShortfall(month): { available, recurringTotal, shortfall, severity, asOf }` — pure synchronous function, no Firestore calls, fully unit-testable.
- `subscribeMonthlyShortfall(month, callback): Unsubscribe` — wires the four `onSnapshot` listeners needed (settings/global, all payments, all withdrawn expenses, all active recurring templates) and re-emits the result on every change.

**Rationale**:
- The pure function is the only piece the spec mandates be unit-tested (FR-032, SC-006). Pulling it out from the subscription lets us test six+ cases in milliseconds with no Firestore emulator.
- The subscription piggybacks on the same listener pattern used in `subscribeMoneyOnHand` (v1). No new client cache library. No new state.
- `asOf` is the most recent `updatedAt` across the four sources — sufficient for "updated within 3s" claims (FR-029, SC-005).
- Negative `available` is supported natively (a month in deficit) — the formula uses raw numbers, never asserts positivity. The banner text is what conveys the warning, not the math.

**Alternatives considered**:
- Denormalised `monthlyShortfall/{YYYY-MM}` doc recomputed on every write via a Cloud Function: extra cost, extra latency, extra failure modes. Rejected — same reason v1 chose live query over denormalised counter.
- Server-side aggregation via Firestore `sum` (still limited to single-field aggregation): not flexible enough for the formula's multi-source inputs. Rejected.

---

## 5. Recurring template type field

**Decision**: `recurringExpenses` documents gain a `type` field (default `"mosque"` for v1), with the same `householdId`/`familyId`/`mosqueSubCategory` cross-field rules as expenses. New templates default to `type: "mosque"` per spec assumption L202.

**Rationale**:
- Spec FR-016 makes it explicit. Without it, the calendar view cannot distinguish a mosque-wide template from a household-linked one in the global view, and the household detail view cannot show only its own templates.
- Defaulting to `mosque` is the path of least surprise — every existing v1 template (electricity, salaries) is mosque-wide, so the migration is implicit.
- Validation reuses the same Zod `discriminatedUnion` shape as expenses. One schema file, two consumers (form + service).

**Alternatives considered**:
- Two separate `mosqueRecurring` and `householdRecurring` collections: same downsides as splitting expenses. Rejected.
- Optional `type` (no default): would let old documents be ambiguous. Rejected — explicit default, the service writes `type: "mosque"` on every `createRecurringTemplate`.

---

## 6. Calendar view data flow

**Decision**: New `src/app/(app)/calendar/page.tsx` page. Uses three live subscriptions:
- `subscribeRecurringTemplates(false)` — list all templates (active and archived) for the global calendar; archived templates are filtered out of the rendering but kept in the subscription.
- `subscribeExpenses(month, ...)` for the currently selected month — gives both ad-hoc expenses and the recurring-id links for status derivation.
- `subscribeMonthlyShortfall(month, ...)` — drives the banner.

**Rationale**:
- The Calendar view is read-only on data — same pattern as Dashboard. Pure consumer of `onSnapshot` listeners.
- Status derivation (`Not added` / `Pending withdrawal` / `Withdrawn`) is computed client-side by joining the template list to the per-month expense list, reusing the `listRecurringTemplatesWithStatus` logic from v1 (extended to accept the expense snapshot rather than re-querying).
- Month navigation is local React state (`selectedMonth`). Subscriptions re-key on the month change.
- Empty state is rendered when both lists are empty for the selected month.

**Alternatives considered**:
- Server-rendered with Server Actions: breaks the < 1s re-render goal (SC-004) when stepping months. Rejected.
- A `subscribeMonthlyShortfall`-only page (no per-month expense subscription): loses the "Pending withdrawal" status for templates. Rejected.

---

## 7. Withdraw confirmation flow for recurring expenses

**Decision**: The existing `WithdrawDialog` is extended. The dialog accepts an `expense` and a `monthTotals` snapshot. If `expense.isRecurring === true`, the dialog shows the expanded summary (name, amount, new month totals, current shortfall). Otherwise, it falls back to the existing lighter confirmation.

**Rationale**:
- Reusing the dialog keeps the visual language consistent.
- The shortfall is read once at dialog open time via the same `computeMonthlyShortfall` (synchronous) so the user sees the figure without a spinner.
- Withdrawal still calls the same `withdrawExpense(uid, expenseId)` service. No new service method.
- The `getMonthlyTotals(month)` helper added to the service returns `{ totalWithdrawn, totalPending, totalAdded, shortfall }` for the dialog. It reuses the same query shapes as the shortfall service.

**Alternatives considered**:
- A separate `RecurringWithdrawDialog` component: code duplication. Rejected — extend the existing one with a `mode` prop or conditional rendering.
- Recomputing shortfall live inside the dialog: wasteful for a one-shot confirmation step. Rejected.

---

## 8. Member-history writes inside household update

**Decision**: A new service method `households.updateMembers(uid, householdId, input)` performs the household update AND appends a `memberHistory` doc in a single batched write. This guarantees that the history doc and the new state can never diverge (FR-004, FR-005).

**Rationale**:
- `firestore.rules` blocks `update` on the household document (v1 invariant). To allow member edits, the rule is updated to permit updates whose `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount', 'memberNames', 'updatedAt', 'updatedBy'])` — a narrow whitelist. This matches the v1 pattern of narrow `allow update` for soft-delete transitions.
- Batching keeps the atomicity guarantee: if either write fails, neither persists.
- The history record is auto-generated by Firestore (no admin-chosen IDs).

**Alternatives considered**:
- Two sequential writes (update household, then add history): non-atomic; if the second fails, the household is updated but the history is lost. Rejected.
- Storing the history inside the household doc as a sub-array: hits the 1 MiB doc limit eventually. Rejected.

---

## 9. Live shortfall subscription performance

**Decision**: `subscribeMonthlyShortfall` opens:
- `onSnapshot(settings/global)` — 1 doc
- `onSnapshot(collectionGroup(db, "payments"))` filtered by `month == M` — covered by existing composite index 1
- `onSnapshot(query(collection(db, "expenses"), where("month", "==", M))` — covered by existing composite index 2
- `onSnapshot(query(collection(db, "recurringExpenses"), where("active", "==", true))` — single-field equality, no new index

**Rationale**:
- SC-005 requires the banner to update within 1s of a data change. `onSnapshot` gives sub-100ms propagation for small data sets.
- All four subscriptions are already used elsewhere in the app (money on hand, dashboard). The Spark quota supports this for the stated scale (tens of households, hundreds of families, thousands of payments).
- No new composite indexes are needed.

**Alternatives considered**:
- One combined query for payments + expenses + recurring templates: not possible in Firestore (no cross-collection joins). Rejected.
- Cloud Function that updates a `monthlyShortfall/{M}` doc on every write: extra latency, extra cost. Rejected — same reason v1 chose live over denormalised.

---

## 10. Toast / inline warning delivery

**Decision**: Use a lightweight inline banner pattern (a `<div role="status" aria-live="polite">` inside the dialog) for the recurring-withdraw confirmation, and a `sonner` toast (already in the v1 deps tree per the `package.json`) for the calendar view banner-toast. No new dependencies.

**Rationale**:
- The dialog needs the warning to be VISIBLE while the user is deciding, not dismissable. A `role="status"` element inside the dialog is the right semantic.
- The calendar view already shows the persistent banner; the "severity worsens" toast is a separate ephemeral signal. `sonner` is already wired (if not, it gets added in the implementation phase).
- Aria-live ensures screen readers announce the change.

**Alternatives considered**:
- `react-hot-toast`: comparable, but the v1 stack already uses shadcn/ui and the `sonner` adapter is the shadcn-canonical choice. Rejected for new dep churn.
- `window.alert`: accessibility-hostile, no styling, breaks the visual design. Rejected.

---

## 11. Calendar empty state

**Decision**: Render an explicit empty card with the literal "No expenses scheduled or recorded for this month" (tagged with `// TODO(i18n)`). The month navigator remains visible and functional.

**Rationale**:
- Spec FR-026 + acceptance scenario US-4.6. An empty state is a soft guarantee against the "broken screen" edge case (L122).
- The literal is added to the inline `i18n` map under a new `calendar.*` namespace, matching the v1 pattern of `useT("calendar.empty")`.

**Alternatives considered**:
- Reusing the `expenses.empty` literal: misleading — calendar empty != no expenses ever. Rejected.

---

## 12. Package and config changes

**Decision**:
- Add `sonner` (or equivalent) if not present in v1's `package.json`; verify during implementation. (Per spec assumption L209, English-only UI; all new strings get a `// TODO(i18n)` tag and go into the existing `useT` map.)
- Add a new `calendar.*` namespace to the `useT` map.
- No new database composite index beyond what v1 already declares.
- No new top-level package — only possibly `sonner` if missing.

**Rationale**:
- The dependency rule is "add only when justified". The toast is the only consumer of the new lib, and the v1 spec already approved the toast pattern conceptually (the `useT` map includes `common.cancel` etc.).
- Composite indexes stay at four total, well under the Spark 200-index limit.

**Alternatives considered**:
- A new `useToast` hook in `src/lib/hooks/`: works but loses the consistent API. If `sonner` is already in v1, use it directly. Rejected as an alternative to using what v1 already has.

---

## 13. Versioning of contracts

**Decision**: v1 contracts in `specs/001-household-finance-dashboard/contracts/` are NOT modified. New types and service methods for 002 are added to a new file `specs/002-members-expenses-calendar/contracts/service-interface.ts` and a new `firestore.rules` extension file. The v1 rules file is mirrored to repo root and a small "delta" patch is applied.

**Rationale**:
- Keeps the two phases cleanly separated. Reviewers can diff the delta in one place.
- The v1 plan stays intact as a historical artifact.

**Alternatives considered**:
- Editing v1 contracts in place: loses the v1 history. Rejected.

---

## Summary of NEEDS CLARIFICATION status

| Item | Status | Decision |
|---|---|---|
| Member history path | RESOLVED | `households/{hhId}/memberHistory/{histId}` sub-collection, append-only |
| Expense `type` field | RESOLVED | `z.discriminatedUnion("type", [...])` with `household` / `mosque` literals |
| Mosque sub-category | RESOLVED | `mosqueSubCategory: "maintenance" \| "salary" \| "other"` on mosque-type expenses and templates |
| Household-scoped expense cascade | RESOLVED | Extended chunked-batch hard delete; mosque expenses not cascaded |
| Recurring template `type` | RESOLVED | Same union shape; default `"mosque"` for new templates |
| Shortfall service shape | RESOLVED | Pure `computeMonthlyShortfall(month)` + `subscribeMonthlyShortfall(month, cb)` |
| Calendar data flow | RESOLVED | Three live subscriptions on the page, all already supported by v1 indexes |
| Withdraw confirmation flow | RESOLVED | Extend `WithdrawDialog` with a `mode` driven by `expense.isRecurring` |
| Member-history atomicity | RESOLVED | Batched write inside `updateMembers`; narrow update rule on household |
| Household update permission | RESOLVED | Allow update iff only `memberCount`/`memberNames`/`updatedAt`/`updatedBy` change |
| i18n / toast deps | RESOLVED | Reuse v1 `useT` map; `sonner` only if absent |
