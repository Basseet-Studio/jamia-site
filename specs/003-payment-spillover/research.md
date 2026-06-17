# Research: Payment Contribution Spillover

**Branch**: `003-payment-spillover` | **Date**: 2026-06-17
**Source**: `spec.md` (5 stories, 30 FRs, 8 SCs)

This document records all technical decisions, library patterns, and tradeoffs resolved during planning. Each entry follows: **Decision → Rationale → Alternatives considered**.

---

## 1. Coverage group identifier — UUID v4 via `crypto.randomUUID()`

**Decision**: Generate a UUID v4 client-side using the browser's built-in `crypto.randomUUID()` API at submit time. Store as `coverageGroupId: string | null` on the payment doc.

**Rationale**:
- `crypto.randomUUID()` is available in all evergreen browsers since 2022 (Chrome 92+, Firefox 95+, Safari 15.4+) — well below the project's target baseline.
- No new dependency needed (`uuid` package avoided → smaller bundle, no supply-chain surface).
- Generated client-side means the dialog can show the preview using the same ID; the ID is committed with the first doc and re-used for sibling docs in the transaction.
- Server-side generation (Firestore auto-IDs) is per-document, so we'd need a round-trip to coordinate a shared ID — wasteful.

**Alternatives considered**:
- Firestore auto-ID with a `sourcePaymentId` back-reference → would require creating the current-month doc first, reading its ID, then writing siblings with the back-ref. Two passes; more complex transaction shape.
- `uuid` npm package → unnecessary; built-in API suffices.
- Server-side timestamp-based ID (e.g., `Date.now()` + random) → collisions possible under concurrent submits; UUIDv4 collision probability is negligible.

---

## 2. Cascade computation — pure module in `src/lib/services/coverage.ts`

**Decision**: Extract the cascade algorithm into a pure module `src/lib/services/coverage.ts` exporting:
- `planCoverage({ amount, date, family, payments, settings }) → CoveragePlan`
- `CoveragePlan = { currentMonth, backMonths: MonthSlot[], futureMonths: MonthSlot[], totalAmount, overLimitRemainder, coverageGroupId }`
- `MonthSlot = { month: string, amount: number }`

**Rationale**:
- Pure function = trivially testable without Firestore. Mirrors the pattern already established by `MonthlyBudgetShortfall` (§5 of `data-model.md` in `002-members-expenses-calendar`).
- The dialog uses `planCoverage()` for the live preview (client-side, no Firestore round-trip per keystroke).
- The submit service re-runs `planCoverage()` **inside the Firestore transaction** so concurrent-payment re-evaluation stays consistent (FR-023).
- Single source of truth for the cascade logic — dialog and service share the same algorithm; no drift.

**Alternatives considered**:
- Putting cascade logic inline in the dialog component → untestable, duplicated logic between dialog and service.
- Computing on the server via Cloud Functions → overkill for client-only data the admin already sees; adds latency to the live preview.

---

## 3. Firestore transaction shape — single `runTransaction` with N writes + one MOH shift

**Decision**: Submit creates all N payment docs and the single MOH shift inside one `runTransaction(db, async tx => ...)`. Pre-create all `doc(collection(...))` refs before the transaction so doc IDs are known (matches existing `recordPayment` pattern).

**Rationale**:
- Preserves v1's **SC-009 atomicity** guarantee: payment writes + MOH shift commit together or not at all. The existing `payments.atomicity.test.ts` regression would fail if this regressed.
- Pre-creating refs keeps the auto-id deterministic; the dialog's `coverageGroupId` is set in the payload, not pulled from the auto-id.
- One MOH shift = group total (not per-doc), matches v1's running-total model.

**Security rule compatibility**: The current `firestore.rules` payment create rule requires `request.resource.data.recordedAt == request.time`. Firestore's `serverTimestamp()` resolves to the same `request.time` for every write inside a single transaction, so all cascaded docs pass the check. Verified by reading `firestore.rules` L151-157 and the v1 payments write path which already uses this pattern.

**Alternatives considered**:
- Batched write (`writeBatch`) → not transactional; can't re-read inside the batch for race-safety (FR-023). Rejected.
- One transaction per payment doc → loses atomicity; rejected.

---

## 4. New composite index for coverage-group queries

**Decision**: Add ONE new composite index in `firestore.indexes.json`:

```
collectionGroup: "payments"
fields: [
  { fieldPath: "coverageGroupId", order: "ASCENDING" },
  { fieldPath: "recordedAt", order: "DESCENDING" }
]
```

**Rationale**:
- The delete-coverage-group flow needs `where("coverageGroupId", "==", id)` to find siblings. Without an index, Firestore raises a missing-index error on this query in production (emulator is permissive).
- Pairing with `recordedAt DESC` makes the result naturally sorted (newest first) without an extra `orderBy` call.
- Composite-index budget: v1 + 002 uses 7; adding one brings the total to 8 (Spark limit is 200 — headroom is fine).

**Alternatives considered**:
- Single-field index on `coverageGroupId` (auto-created by Firestore for equality filters) → sufficient for the query but doesn't provide `recordedAt` ordering. The dashboard list already orders by `recordedAt DESC`, so adding the composite avoids an in-memory sort.
- No index, rely on collection scan → unsafe in production; rejected.

---

## 5. Schema evolution — additive `coverageGroupId` field on Payment

**Decision**:
- Extend `src/lib/types/index.ts` `Payment` interface with `coverageGroupId: string | null`.
- Extend `src/lib/schemas/payment.ts` `recordPaymentSchema` (or a new sibling `recordPaymentWithCoverageSchema`) to accept `coverageGroupId: z.string().uuid().nullable().optional()`.
- The Firestore `create` rule does **not** require the field — leaving it absent reads back as `undefined`/missing, which the type adapter maps to `null` (mirrors v1's `note: null` pattern at `src/lib/services/payments.ts:42`).
- The Zod schema re-validation in the service layer (per v1 invariant) catches malformed coverage IDs before they reach Firestore.

**Rationale**:
- Additive, nullable → zero impact on existing payment docs (FR-029).
- Optional in the schema → callers that don't pass it (e.g., the legacy single-payment path in `recordPayment`) get the same behaviour as today.
- Type adapter change is one line: `coverageGroupId: (data.coverageGroupId as string | undefined) ?? null`.

**Alternatives considered**:
- Storing coverage as a sub-collection on the family (`families/{fid}/coverageGroups/{cgid}`) → denormalises the data model; payment list queries would need a join. Rejected — keeps payments sub-collection as the single source of truth.
- Encoding coverage group into the existing `note` field (e.g., `[cgid:xxx] back-fill`) → unsearchable, fragile, hard to query for delete. Rejected.

---

## 6. Live preview hook — derived state, no Firestore calls

**Decision**: The Record Payment dialog uses `useMemo(() => planCoverage({...}), [amount, date, family, payments, settings])` for the live preview. No Firestore subscription needed inside the dialog — the parent's existing `subscribePayments` already feeds `payments` into the page.

**Rationale**:
- Re-computation per keystroke is O(unpaid months) which is at most ~24 (2 years of monthly gaps) — negligible (<1ms).
- No subscription = no extra listeners, no race conditions between the preview and the eventual submit.
- Preview matches submit output by construction (same `planCoverage()` algorithm), satisfying SC-006.

**Alternatives considered**:
- Debounced Firestore read → adds latency to the live indicator (SC-005 requires <100ms response).
- Web Worker for compute → overkill for a tiny list.

---

## 7. Future-months checkbox visibility — derived from coverage plan

**Decision**: The checkbox renders only when `planCoverage().backMonths.length === 0 && currentMonth.month !== undefined && currentMonth.isAlreadyCovered === false`. In all other cases it's hidden (FR-013).

**Rationale**:
- Putting visibility logic in the same module that computes the plan keeps the rule and the UI in lockstep. If the algorithm changes, the UI follows.
- "Back is clear" means both back-month cascade and current-month cascade don't apply. If the current month is already paid (a future over-limit case), back is vacuously clear and the checkbox shows.

**Alternatives considered**:
- Boolean prop on the dialog component → caller has to recompute; drifts if the rule changes. Rejected.

---

## 8. Delete coverage group — same `runTransaction`, group-aware query

**Decision**: Replace (or add) `deletePayment` to detect `coverageGroupId`:
- If `null` → existing single-doc path (unchanged, FR-028).
- If present → first confirm with the admin (FR-025), then in one `runTransaction`: `tx.get()` all siblings (`where("coverageGroupId", "==", id)`), `tx.delete()` each, and `tx.update(settings/global.moneyOnHand, -sumAmounts)`.

**Rationale**:
- Single transaction preserves SC-009 atomicity.
- The confirmation dialog reads sibling count + months via a one-shot `getDocs` before the transaction, then the transaction re-reads inside the txn (Firestore transactions re-read at commit time, so a concurrent delete of a sibling would surface as `tx.get()` returning fewer docs — handled gracefully).
- Reuses `shiftMoneyOnHandInTx(tx, -total)` helper from `src/lib/services/moneyOnHand.ts`.

**Alternatives considered**:
- Cloud Function trigger → overkill; admin-only operation.
- Soft-delete (`active: false`) → not in v1 model; rejected.

---

## 9. Money on hand shift — once per group, not per doc

**Decision**: When submitting a cascade of N docs, call `shiftMoneyOnHandInTx(tx, +totalAmount)` exactly once inside the transaction, where `totalAmount = sum of all docs in the group`. When deleting a group, call `shiftMoneyOnHandInTx(tx, -groupTotal)` once.

**Rationale**:
- Matches v1's "one MOH move per business event" invariant.
- The running total `moneyOnHand` is `openingBalance + Σ payments - Σ withdrawn expenses`. Each cascade is logically one payment event from the MOH perspective, even though it's persisted as N docs for query convenience.
- Calling the helper N times in the same transaction would be redundant reads of `settings/global` (still correct, but wasteful).

**Alternatives considered**:
- One MOH move per doc → functionally identical but redundant; rejected for clarity.

---

## 10. Localisation ownership — `useT()` hook + `// TODO: localise` comments

**Decision**: All new user-facing strings use the `useT()` hook from `src/lib/i18n`. Strings not yet in the ARB files get an inline `// TODO: localise this later` comment, per the project standing rule.

**Rationale**:
- Project convention (v1, 002). See `src/components/payments/RecordPaymentDialog.tsx` for the existing pattern (`t("payments.recordButton")` etc.).
- The skill explicitly directs to skip ARB file edits during planning/implementation.

---

## 11. Race-condition mitigation — in-transaction re-evaluation

**Decision**: Inside the cascade transaction, BEFORE writing any doc, re-read the family's payments sub-collection and **re-filter** the planned months against what's already paid. Skip any month that now has a payment (committed by a parallel admin between the dialog open and the submit). FR-023 enforces this.

**Rationale**:
- Firestore `runTransaction` automatically retries on contention. The re-read inside the transaction sees the latest committed state.
- Without this, two admins submitting over-limit cascades for the same family simultaneously could each create a doc for the same month — double-pay.
- Cost: one extra `tx.get()` per submit (the family's payments sub-collection is small for a single family — sub-millisecond in practice).

**Alternatives considered**:
- Optimistic write + reconciliation → complicates the UI (would need to surface "skipped months" post-submit). Transactional re-eval is cleaner and SC-007 explicitly tests this.

---

## 12. Test strategy

**Decision**: Mirror v1's two-level pattern (`payments.test.ts` module-shape + `payments.atomicity.test.ts` emulator-backed):
1. `coverage.test.ts` — pure-function tests for `planCoverage()` covering: full back cascade, partial back cascade (no fill), no back cascade (already paid), future cascade with tick, future cascade without tick, target=0, legacy family, race scenario (input payments already include a would-be cascade month).
2. `payments.cascade.test.ts` — emulator-backed: submit creates N docs in one transaction, MOH shifts by total, siblings share coverageGroupId, delete group is atomic.
3. `RecordPaymentDialog.test.tsx` — UI test: over-limit indicator appears, preview re-computes on amount change, future checkbox hides when back cascade applies.

**Rationale**: Matches existing test pyramid in `tests/unit/services/`. No new tooling needed.

**Alternatives considered**:
- Playwright e2e for the dialog → overkill for unit-level coverage; e2e suite already exists at `tests/e2e/` and can be extended later.

---

## 13. Out-of-scope confirmations

Per spec edge cases explicitly NOT addressed in v1:
- Re-applying excess when a payment is deleted → FR-026 only deletes; no re-distribution.
- Editing an existing coverage group → not exposed (FR-015 says no `updatePayment` in v1).
- Refund/clawback when `contributionTarget` changes retroactively → no retroactive adjustment (per Assumptions).
- Showing "spillover" badge in payment history table → not required by spec; can be added later without breaking this plan.

---

## Summary of decisions

| # | Decision | Location |
|---|---|---|
| 1 | UUID v4 via `crypto.randomUUID()` | `src/lib/services/coverage.ts` |
| 2 | Pure `planCoverage()` module | `src/lib/services/coverage.ts` |
| 3 | Single `runTransaction` for cascade submit | `src/lib/services/payments.ts` |
| 4 | New composite index `coverageGroupId + recordedAt` | `firestore.indexes.json` |
| 5 | Additive nullable `coverageGroupId` on Payment | `src/lib/types/index.ts`, `src/lib/schemas/payment.ts` |
| 6 | `useMemo` live preview, no Firestore calls | `src/components/payments/RecordPaymentDialog.tsx` |
| 7 | Checkbox visibility derived from plan | `src/components/payments/RecordPaymentDialog.tsx` |
| 8 | Group-aware `deletePayment` in one transaction | `src/lib/services/payments.ts` |
| 9 | One MOH shift per group, not per doc | `src/lib/services/payments.ts` |
| 10 | `useT()` + `// TODO: localise` for new strings | All new components |
| 11 | In-transaction re-read for race safety | `src/lib/services/payments.ts` |
| 12 | Vitest unit + emulator-backed tests | `tests/unit/` |
| 13 | Out-of-scope per spec Edge Cases | n/a |

No open `NEEDS CLARIFICATION` items. Ready for Phase 1 design.