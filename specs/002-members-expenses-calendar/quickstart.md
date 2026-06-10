# Quickstart: Household Members, Expense Types, Calendar View, Budget Shortfall

**Branch**: `002-members-expenses-calendar` | **Date**: 2026-06-10

Adds 002 to the v1 setup. Assumes v1 (per `specs/001-household-finance-dashboard/quickstart.md`) is already installed and running.

---

## What's new in 002

- Households get a `memberCount` + `memberNames` field with full change history (`households/{hhId}/memberHistory/*`).
- Every expense has a `type` (`household` | `mosque`) with linkage (`householdId`/`familyId`) or a `mosqueSubCategory`.
- Recurring templates also carry a `type` (defaulting to `mosque`).
- New `/calendar` page lists each month's recurring templates (with per-month status) and ad-hoc expenses, plus a budget shortfall banner.
- New `BudgetShortfallService` warns when the month's available funds cannot cover the sum of active recurring expenses.

## 1. Pull the latest rules + indexes

After deploy of this branch, the v1 rules file is patched with the 002 delta (see `contracts/firestore.rules`). Run:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

This deploys:

- The patched rules (household update allowlist + member-history append-only + extended expense/recurring guards).
- The three new composite indexes declared in `firestore.indexes.json` (delta over v1):
  - `expenses` — `type`, `mosqueSubCategory`, `month`
  - `expenses` — `householdId`, `type`, `month`
  - `recurringExpenses` — `type`, `active`

## 2. Smoke test the new flows

Sign in as the owner. Then:

1. **Household members**: open any household, edit the member count and names, save, open the "Member change history" view, confirm a new row appears with the previous and new values. Edit again, confirm a second row appears.
2. **Expense type**: open the expenses list, add an expense with type `mosque` and sub-category `salary`. Add a second expense with type `household` linked to a household. Confirm the expenses list shows the right badge on each row.
3. **Recurring template type**: open `/recurring`, add a new template — it defaults to `mosque`. Edit one of the new templates via the type field to `household` and pick a household. Save.
4. **Calendar view**: open `/calendar` (new nav item). Confirm the current month shows recurring templates (with `Not added` status) and any ad-hoc expenses logged in the month. Step one month back/forward via the navigator.
5. **Shortfall warning**: in `/calendar`, the shortfall banner should read "On track" (green) when available funds cover recurring total. If you add an ad-hoc expense that pushes the month into deficit, the banner re-renders to amber (`watch`) or red (`risk`) within 1 second (SC-005).
6. **Recurring withdraw confirmation**: from `/recurring`, add a template for the current month (creates a non-withdrawn expense), then open the expense and click Withdraw. The expanded dialog should show the name, amount, new month totals, and current shortfall (US-3). Confirm, watch the expense flip to withdrawn and money on hand drop.
7. **Hard delete cascade**: from the households list, hard-delete a household that has families, payments, member history, and household-scoped expenses. Confirm all of those disappear in a single batched write (SC-008).

## 3. Unit tests

```bash
pnpm test                                  # full vitest suite
pnpm test src/lib/services/shortfall.test  # just the shortfall service (FR-032 cases)
```

The shortfall test suite covers at minimum:

- Zero active templates → `severity = "ok"`, no banner.
- Exact match (`available == recurringTotal`) → `severity = "ok"`.
- 5% gap → `severity = "watch"`.
- 10% gap (boundary, inclusive) → `severity = "watch"`.
- 50% gap → `severity = "risk"`.
- Negative `available` (month in deficit) → service does not throw; `shortfall` may exceed `recurringTotal`.

## 4. New nav entry

The 002 branch adds `/calendar` to the AppShell nav. No other nav changes.

## 5. New i18n keys

All under the `calendar.*` namespace:

- `calendar.title`
- `calendar.empty` — "No expenses scheduled or recorded for this month" (FR-026)
- `calendar.recurringHeading`
- `calendar.adHocHeading`
- `calendar.status.notAdded`
- `calendar.status.pendingWithdrawal`
- `calendar.status.withdrawn`
- `calendar.action.addForMonth`
- `calendar.shortfall.onTrack`
- `calendar.shortfall.watch`
- `calendar.shortfall.risk`
- `calendar.monthPrev`
- `calendar.monthNext`

All literals are English-only in v1 and tagged with `// TODO(i18n)`.

## Common gotchas

- **"Missing or insufficient permissions" on household member edit**: the patched rules have not been deployed. Re-run `firebase deploy --only firestore:rules`.
- **Calendar shows no recurring templates even though they exist**: confirm the templates have `active: true` (archived templates are hidden from the calendar, per spec).
- **Shortfall banner stuck on "On track"** when a new expense was logged: the `onSnapshot` listeners need a hard refresh — they're per-tab. SC-005's 1s claim is for an already-open tab.
- **Hard delete fails partway**: re-run the delete. It's idempotent (re-running on a household whose children are already gone is a no-op).

## Where to look

- `data-model.md` — every entity, field, validation, derived value
- `contracts/service-interface.ts` — 002-only service methods (additive over v1)
- `contracts/firestore.rules` — the 002 rules delta
- `research.md` — rationale for each design choice
- `specs/002-members-expenses-calendar/spec.md` — the product spec
- `specs/001-household-finance-dashboard/` — v1 artifacts (read-only reference)
