# Tasks: Payment Contribution Spillover

**Input**: Design documents from `/specs/003-payment-spillover/`
- spec.md (5 user stories, 30 FRs, 8 SCs)
- plan.md (tech stack: Next.js 16, React 19, Firebase 12, Zod 4, Vitest 3)
- data-model.md (additive `coverageGroupId` field; derived `CoveragePlan`/`CoverageGroup`)
- research.md (13 decisions: UUID v4, pure `planCoverage()`, single `runTransaction`, 1 new composite index)
- contracts/firestore.rules (delta: UUID format check on `coverageGroupId`)
- quickstart.md (9 e2e scenarios)

**Tests**: Required per research §12 (two-level pattern: pure unit + emulator-backed atomicity).

**Organisation**: Tasks grouped by user story. Foundational phase exposes the pure `planCoverage()` algorithm so US1 (indicator) and US3 (preview) can be built independently of US2's transactional submit path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Apply additive infrastructure changes (rules + index) that are version-controlled artefacts and have no code dependencies.

- [x] T001 Add composite index `coverageGroupId + recordedAt DESC` to `firestore.indexes.json`
- [x] T002 Apply Firestore rules delta from `specs/003-payment-spillover/contracts/firestore.rules` to repo-root `firestore.rules` (UUID format check on `coverageGroupId`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure algorithm + type/schema plumbing that ALL user stories depend on. No UI, no transaction code.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T003 Extend `Payment` interface in `src/lib/types/index.ts` with `coverageGroupId: string | null`
- [x] T004 Extend `recordPaymentSchema` and add `recordPaymentWithCoverageSchema` in `src/lib/schemas/payment.ts` (UUID format when present; `applyToFutureMonths: boolean` for the cascade variant)
- [x] T005 Update `toPayment` type adapter in `src/lib/services/payments.ts` to map `coverageGroupId` (default null for legacy docs)
- [x] T006 Create pure `planCoverage()` module in `src/lib/services/coverage.ts` exporting `planCoverage()`, `CoveragePlan`, `MonthSlot` types; implements algorithm from `data-model.md` §2 (target=0 guard, `family.createdAt` start, oldest-first back cascade, opt-in future cascade, whole-month rule, race-safe `paidSet` filter)
- [x] T007 [P] Pure-function tests for `planCoverage()` in `tests/unit/services/coverage.test.ts` — full back cascade, partial back cascade (no fill), no back cascade (already paid), future cascade with tick, future cascade without tick, target=0, legacy family (no `createdAt`), race scenario (input payments include a would-be cascade month)

**Checkpoint**: Foundation ready — `planCoverage()` is pure + tested; type and schema carry `coverageGroupId`; rules + index deployed. User story UI and submit work can begin.

---

## Phase 3: User Story 1 — Over-limit warning while entering a payment (Priority: P1) 🎯 MVP

**Goal**: Record Payment dialog shows a live "Over limit by X" indicator when `enteredAmount > family.contributionTarget`; hides when not over limit.

**Independent Test**: Open dialog for family with `contributionTarget = 500`. Type `300` → no indicator. Type `600` → "Over limit by 100" appears within ~100ms. Type `500` → indicator hides. Cancel → no side effects.

### Implementation for User Story 1

- [x] T008 [US1] Add over-limit indicator to `src/components/payments/RecordPaymentDialog.tsx` — derive `{ overLimit, plan }` via `useMemo(() => planCoverage({...}), [amount, date, family, payments, applyToFutureMonths])`; render `t("payments.overLimitBy", { amount })` when `overLimit > 0`, hidden otherwise (FR-002, FR-003, FR-004); add `// TODO: localise this later` marker on the string literal fallback
- [x] T009 [P] [US1] UI test in `tests/unit/ui/RecordPaymentDialog.test.tsx` — over-limit indicator appears/hides on amount change; renders correct currency-formatted delta

**Checkpoint**: US1 fully functional. MVP demo ready — admin sees the over-limit signal. Cascade submit + preview + group delete still pending.

---

## Phase 4: User Story 2 — Auto-cascade excess to unpaid back months (Priority: P1)

**Goal**: Submitting an over-limit payment creates N payment docs in one Firestore transaction: one for current month + one per unpaid back month filled oldest-first. All share a `coverageGroupId`. MOH shifts by the group total in the same transaction.

**Independent Test**: Family `contributionTarget = 500`, `createdAt = 2026-01`, no payments. Admin records `1500` dated `2026-06-17`. Verify 3 docs (`2026-06`, `2026-01`, `2026-02`), shared `coverageGroupId`, identical `date`/`recordedBy`, single MOH shift of `+1500`.

### Tests for User Story 2 ⚠️

> NOTE: Write emulator-backed tests FIRST; ensure they fail before implementation.

- [x] T010 [P] [US2] Emulator-backed cascade test in `tests/unit/services/payments.cascade.test.ts` — submit creates N docs in one txn, all share `coverageGroupId`, MOH shifts by group total, partial-cascade writes `amount = target` on current-month doc (not the over-limit entered amount)
- [x] T011 [P] [US2] In-txn race-safety test in `tests/unit/services/payments.cascade.test.ts` — second cascade re-reads payments inside txn, skips months paid by parallel commit (FR-023, SC-007)

### Implementation for User Story 2

- [x] T012 [US2] Implement `recordPaymentWithCoverage(uid, args)` in `src/lib/services/payments.ts` — wraps one `runTransaction`, calls `planCoverage()` inside the txn, re-reads family's payments sub-collection to filter out newly-paid months (FR-023), pre-creates all `doc(collection(...))` refs, `tx.set()` for each slot with shared `coverageGroupId` + admin-entered `date` + `recordedBy`, calls `shiftMoneyOnHandInTx(tx, +totalAmount)` once at end (FR-021, FR-022, FR-024; SC-009)
- [x] T013 [US2] Re-export `recordPaymentWithCoverage` from `src/lib/services/index.ts`

**Checkpoint**: US1 + US2 both work. Over-limit indicator visible, cascade submit writes N docs atomically. Preview + future-months + group delete still pending.

---

## Phase 5: User Story 3 — Coverage preview before submit (Priority: P2)

**Goal**: Before submit, dialog renders a preview block listing the months to be covered in cascade order with per-month amount + total + remaining-over-limit line.

**Independent Test**: Trigger a 3-month cascade — preview block lists `2026-06 (current)`, `2026-01`, `2026-02` with `500` each and total `1500`. Re-computes on every keystroke (FR-019). Hidden when no cascade triggered (FR-020).

### Implementation for User Story 3

- [x] T014 [US3] Add preview block to `src/components/payments/RecordPaymentDialog.tsx` — renders current-month slot first, then backMonths oldest→newest, then futureMonths oldest→newest when applicable; shows per-slot `amount` formatted in household currency, total at bottom, and "Remaining over-limit on [month]: X" line when `overLimitRemainder > 0`; hidden when no slots exist (FR-017, FR-018, FR-020); `useMemo` re-computes on amount/date change (FR-019); add `// TODO: localise this later` markers on new strings
- [x] T015 [P] [US3] UI test in `tests/unit/ui/RecordPaymentDialog.test.tsx` — preview block lists cascade order; re-computes on amount change; renders "Remaining over-limit" line; hides when no cascade triggered

**Checkpoint**: US1, US2, US3 complete. Admin sees indicator → sees preview → submits cascade that matches preview exactly (SC-006).

---

## Phase 6: User Story 4 — Opt-in future-month cascade when back is fully paid (Priority: P2)

**Goal**: When back-month cascade has nothing to fill, dialog shows an unchecked "Apply excess to future months" checkbox; ticking it causes submit to cascade forward into future unpaid months.

**Independent Test**: All months Jan–Jun 2026 paid. Admin records `1500` dated `2026-06-17`, ticks the checkbox → 3 docs (`2026-06` current, `2026-07`, `2026-08` future). Without the tick → only 1 doc at `amount = 500`, no future docs.

### Implementation for User Story 4

- [x] T016 [US4] Wire future-months checkbox in `src/components/payments/RecordPaymentDialog.tsx` — visibility derived from `planCoverage()`: shown only when `backMonths.length === 0 && currentMonth !== null` (FR-013, research §7); checkbox state plumbs into `planCoverage({ applyToFutureMonths })` for live preview; add `// TODO: localise this later` marker
- [x] T017 [US4] Pass `applyToFutureMonths` through to `recordPaymentWithCoverage` call site in `src/components/payments/RecordPaymentDialog.tsx` — the txn's `planCoverage()` call receives the same flag, so future cascade commits atomically with current-month doc (FR-010–FR-012)
- [x] T018 [P] [US4] UI test in `tests/unit/ui/RecordPaymentDialog.test.tsx` — checkbox hidden when back cascade applies; visible + unchecked when back is clear; ticking adds future slots to preview and to submit

**Checkpoint**: US1–US4 complete. Both back-month (auto) and future-month (opt-in) cascades work end-to-end.

---

## Phase 7: User Story 5 — Delete coverage group as one unit (Priority: P3)

**Goal**: Clicking delete on any payment with a `coverageGroupId` prompts for group-level deletion; confirming removes all sibling docs + decrements MOH by group total in one transaction. Legacy single-doc delete path unchanged.

**Independent Test**: After a 3-month cascade, click delete on the current-month row → confirm prompt reads "This will also remove 2 cascaded payment(s) in this coverage group: January 2026, February 2026. Continue?". Confirm → all 3 docs removed, MOH down by 1500 in one commit (SC-004).

### Tests for User Story 5 ⚠️

- [x] T019 [P] [US5] Emulator-backed group-delete test in `tests/unit/services/payments.cascade.test.ts` — group delete removes N docs and decrements MOH by group total in one txn; legacy doc (no `coverageGroupId`) takes single-doc path unchanged (FR-028, SC-004, FR-029)

### Implementation for User Story 5

- [x] T020 [US5] Add `listPaymentsByCoverageGroup(householdId, familyId, coverageGroupId)` to `src/lib/services/payments.ts` — collection-group query `where("coverageGroupId", "==", id)` using the new composite index; returns `Payment[]`
- [x] T021 [US5] Modify `deletePayment()` in `src/lib/services/payments.ts` to detect `coverageGroupId`: if null → existing single-doc path (unchanged); if present → single `runTransaction` that re-reads siblings via `tx.get()`, `tx.delete()` each, and `shiftMoneyOnHandInTx(tx, -sumAmounts)` once (FR-026, SC-004, SC-009, research §8)
- [x] T022 [US5] Update `src/components/payments/DeletePaymentDialog.tsx` — fetch sibling count + months via `listPaymentsByCoverageGroup` before opening; show group prompt "This will also remove N cascaded payment(s): [months]. Continue?" when `coverageGroupId` is present; fall back to legacy single-doc prompt otherwise (FR-025, FR-027, FR-028); add `// TODO: localise this later` marker on the group-prompt string

**Checkpoint**: All 5 user stories independently testable. Full feature shippable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety, type/lint hygiene, e2e smoke.

- [x] T023 Run existing `tests/unit/services/payments.test.ts` and `tests/unit/services/payments.atomicity.test.ts` suites — confirm zero changes needed (SC-008)
- [x] T024 Run `pnpm typecheck` and `pnpm lint` — no new `any` leaks; passes clean
- [ ] T025 Walk through all 9 scenarios in `specs/003-payment-spillover/quickstart.md` against the running dev server + Firestore emulator; verify SC-001 through SC-008

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No code dependencies — deploys index + rules delta first.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories.**
- **User Stories (Phase 3+)**: All depend on Foundational completion.
  - US1, US2, US3, US4, US5 can proceed in priority order (P1 → P1 → P2 → P2 → P3).
  - US3 depends on US2's `recordPaymentWithCoverage` being callable — though US3's preview UI only needs the pure `planCoverage()` from Foundational; the actual submit through US2's path is exercised by US4 (which passes `applyToFutureMonths`).
  - US5 depends on US2 having created coverage groups with `coverageGroupId` in the schema/type (Foundational), and on `deletePayment` being callable.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### User Story Dependencies

| Story | Priority | Depends on |
|---|---|---|
| US1 — Over-limit indicator | P1 | Foundational only (`planCoverage()`) |
| US2 — Back cascade submit | P1 | Foundational only |
| US3 — Coverage preview | P2 | Foundational only (preview uses `planCoverage()` output; submit path comes from US2 but US3 can render preview before US2 lands) |
| US4 — Future-month cascade | P2 | US2 (must thread `applyToFutureMonths` into the txn) |
| US5 — Delete coverage group | P3 | US2 (must have created `coverageGroupId` rows to test against) |

### Within Each User Story

- Tests (if present) MUST be written and FAIL before implementation.
- Pure algorithm → service → UI, in that order.
- Story complete before moving to next priority.

### Parallel Opportunities

- Phase 1: T001 and T002 are independent files → `[P]`.
- Phase 2: T003, T004, T005 are different files → `[P]`. T006 must complete before T007 can run meaningfully.
- Phase 4: T010 and T011 are independent test cases within the same suite file (Vitest handles parallel test cases) → `[P]`.
- Phase 5: T014 and T015 touch dialog + test respectively → `[P]` for the test.
- Phase 6: T018 can run alongside T016/T017 (independent test additions).
- Phase 7: T019 independent of T020/T021/T022 → `[P]`.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Type + schema + adapter edits in parallel (different files):
Task: "Extend Payment interface in src/lib/types/index.ts"
Task: "Extend recordPaymentSchema and add recordPaymentWithCoverageSchema in src/lib/schemas/payment.ts"
Task: "Update toPayment type adapter in src/lib/services/payments.ts"

# Then the pure module + its tests (sequential — tests need the module):
Task: "Create pure planCoverage() module in src/lib/services/coverage.ts"
Task: "Pure-function tests in tests/unit/services/coverage.test.ts"
```

---

## Parallel Example: Phase 4 (US2)

```bash
# Tests first (fail), then implementation:
Task: "Emulator-backed cascade test in tests/unit/services/payments.cascade.test.ts"
Task: "In-txn race-safety test in tests/unit/services/payments.cascade.test.ts"
Task: "Implement recordPaymentWithCoverage() in src/lib/services/payments.ts"
Task: "Re-export from src/lib/services/index.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup (T001, T002)
2. Phase 2: Foundational (T003–T007)
3. Phase 3: US1 indicator (T008, T009)
4. **STOP and VALIDATE**: Type 600 in dialog → see "Over limit by 100". Cancel. No writes.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → demo "over-limit warning" (MVP).
3. + US2 → demo full back-month cascade submit.
4. + US3 → demo preview-before-submit trust build.
5. + US4 → demo opt-in future cascade.
6. + US5 → demo coverage-group delete.
7. Each story adds value without breaking previous ones (additive schema throughout).

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together.
2. Once Foundational done:
   - Dev A: US1 (indicator) + US3 (preview) — both are pure UI work on `RecordPaymentDialog.tsx`.
   - Dev B: US2 (back cascade submit) — service-layer work in `payments.ts`.
   - Dev C: US4 (future cascade wiring) after US2 lands.
3. US5 (group delete) follows once US2 has created real coverage groups to test against.

---

## Notes

- [P] tasks = different files, no dependencies.
- [US#] label maps task to user story for traceability.
- Each user story is independently completable and testable after Foundational lands.
- Localisation deferred — new strings carry `// TODO: localise this later` markers; no ARB edits in this task set.
- `crypto.randomUUID()` is browser-native; no new runtime deps.
- Composite-index count: 7 → 8 (Spark limit 200).
- Race-safety guarantee (FR-023, SC-007) lives entirely in the txn re-read inside `recordPaymentWithCoverage` — no separate debounce or reconciliation layer needed.
