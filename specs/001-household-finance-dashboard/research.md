# Research: Veeramangalam Juma Masjid Household Finance Dashboard

**Branch**: `001-household-finance-dashboard` | **Date**: 2026-06-09

Resolves all `NEEDS CLARIFICATION` items from `plan.md` Technical Context. Each decision follows the format **Decision / Rationale / Alternatives considered**.

---

## 1. Testing stack

**Decision**: Vitest 2 + `@testing-library/react@16` for unit and service tests. Playwright 1 for E2E on critical flows (sign-in, record payment, withdraw expense, soft delete family, all-time expense toggle).

**Rationale**:
- Vitest is the de-facto standard for Next.js 15 + TypeScript projects: Vite-native, ESM-first, fast HMR for tests, no `babel.config` drift.
- Playwright handles Firebase Auth's Google sign-in popup reliably via `chromium.launch` + `context().clearCookies()` between tests.
- E2E tests can assert the < 3s update latency (SC-002, SC-003, SC-005) since Playwright measures real wall-clock time.
- Test data isolated via Firestore Emulator Suite (ships with `firebase-tools`).

**Alternatives considered**:
- Jest: slower ESM startup, more config drift with Next 15.
- Cypress: weaker for OAuth popups, slower runner, vendor lock-in.
- Storybook interaction tests only: doesn't cover multi-page flows like soft delete.
- Skip E2E: rejected because SC-006 (access control) and SC-007 (empty states) need a real browser.

---

## 2. Next.js App Router over Pages Router

**Decision**: App Router (RSC + Server Actions + Route Handlers) for the entire app. No Pages Router code.

**Rationale**:
- Server Components reduce client bundle size — a single-admin dashboard is read-heavy and benefits from server-rendered HTML.
- Server Actions give us server-side writes (the service layer) without a separate API layer; the action signature IS the contract.
- App Router is the default for new Next.js 15 projects in 2026; choosing Pages Router would be writing legacy code from day one.
- Auth flow works cleanly: client component for sign-in (Firebase Auth is client-side), server components for everything after auth resolves.

**Alternatives considered**:
- Pages Router: more tutorials, but legacy for greenfield.
- Vite + React (no Next.js): loses server actions, route conventions, Vercel-native deploy, image optimization.
- Remix: comparable but Vercel + Firebase support is better-documented for Next.js.

---

## 3. Firestore over Realtime Database

**Decision**: Firestore throughout. No Realtime Database.

**Rationale**:
- `main spec.md` §1 pins the data layer to collections + sub-collections — this is Firestore's idiomatic shape.
- Better query model: `where("month", "==", "2025-06")` is a single indexed query, no client-side fan-out.
- Stronger security rules language (`request.auth.uid`, `resource.data`).
- Real-time listeners via `onSnapshot` give us SC-002 / SC-003's "< 3s update" requirement without manual refresh.
- Free Spark tier quotas are sufficient for v1's stated scale (tens of households, hundreds of families, thousands of payments).

**Alternatives considered**:
- Realtime Database: weaker query model, would force denormalised trees for the same data.
- Supabase / Postgres: extra project setup, less aligned with Vercel+Firebase hosting story.
- Custom Node + Postgres backend: far too much operational overhead for one admin.

---

## 4. Firestore Security Rules as the access contract

**Decision**: Encode every authorisation rule in `firestore.rules`, NOT in the client. Client never reads/writes without rules backing it.

**Rationale**:
- SC-006 requires that an unauthorised user CANNOT retrieve any data — server-side enforcement is the only way to guarantee that. Client-side guards are UX, not security.
- The rules file lives in `contracts/firestore.rules` (mirrored to repo root) and deploys with `firebase deploy --only firestore:rules`.
- Rules cover: must be authenticated, must have a doc in `admins/{uid}`, can read everything (single-tenant app), can write only via the schema we define. Family hard delete is blocked (soft delete only via the `active: true → false` transition).

**Alternatives considered**:
- App Check + per-user IAM: extra friction, Firebase Spark supports App Check in enforcement mode only with credit-card billing, not free tier.
- Cloud Functions as the only write path: doubles the write latency and the bill. Not justified for v1.

---

## 5. Soft delete + family ID reservation

**Decision**: Service layer (`families.ts`) is the only place that ever writes a family document. New family IDs are Firestore auto-generated via `addDoc`. The auto-ID is unique across all time, so "ID never reused" is free.

**Rationale**:
- FR-012 is an invariant: a soft-deleted family's ID is never reused.
- The simplest enforcement is "use Firestore auto-IDs and never call `set` with a chosen ID" — auto-IDs are unique across all time, so reservation is automatic.
- `firestore.rules` allows the soft-delete write (`active: false`, `deletedAt`, `deletedBy`) but blocks any `delete()` on family and payment paths.

**Alternatives considered**:
- A "deleted families" tombstone collection: redundant, more code.
- Sequential numeric IDs: requires a counter doc, race conditions, more code, no upside.

---

## 6. Money on hand as a live derived query

**Decision**: `useMoneyOnHand()` hook subscribes to three `onSnapshot` listeners (settings/global, all payments across all families, all expenses where `withdrawn === true`) and computes the total in the client.

**Rationale**:
- SC-009 requires the formula to be exact and reactive. Real-time listeners give us that without manual cache invalidation.
- Firestore's free tier supports the small volume (thousands of payments, never enough to break quota).
- Aggregation on the client avoids Firestore's lack of full-table aggregate queries (no native `SUM`).
- The collection-group query on `payments` is the only way to span all households — that's a v1 Firestore feature, well supported.

**Alternatives considered**:
- A denormalised counter doc that increments on every write: two-phase writes, money can drift if any write fails, more bug surface.
- Cloud Function on every write to update a `moneyOnHand` doc: extra latency, extra cost, more failure modes.

---

## 7. Data flow: onSnapshot everywhere, no client cache library

**Decision**: All live data (dashboard, money on hand, household summary, family history, expense list, recurring templates) is consumed via custom React hooks in `src/lib/hooks/` that wrap Firestore's `onSnapshot` and store the result in local state. Writes call service functions directly; the active `onSnapshot` listeners propagate the new value to the UI. No TanStack Query, no SWR, no manual cache invalidation.

**Rationale**:
- The app is small (one admin, one tenant, low write rate). The complexity of a client cache library is not justified.
- `onSnapshot` is already the source of truth for the "live" surfaces; introducing a parallel cache just creates two sources of truth that must be kept in sync.
- Writes are simple imperative calls (e.g., `await services.payments.recordPayment(...)`). The matching `onSnapshot` listener fires on the next Firestore update and React re-renders. No optimistic update, no rollback.
- This matches the spec's "updates immediately" rule (US-2, US-4, US-5) — the only way to guarantee that without polling is `onSnapshot`.
- Smaller bundle, fewer dependencies, fewer abstractions to teach.

**Alternatives considered**:
- TanStack Query: gives optimistic updates and predictable cache invalidation, but requires a parallel cache that must be kept in sync with the Firestore live source. Not worth the complexity at this scale.
- SWR: same trade-off as TanStack Query, less ergonomic for the mutation flow.
- Server Actions + `revalidatePath`: works for read-after-write on the same server, but not for cross-client live updates.
- Polling (`useSWR` with `refreshInterval`): wastes reads, violates the "updates immediately" spec rule.
- One-shot `getDocs` only: fails SC-002 / SC-003 ("updates within 3 seconds").

---

## 8. Date handling

**Decision**: `date-fns@3` for date math and `format(date, "yyyy-MM")` for the month key. No `date-fns-tz` in v1 — defer until time zone is requested.

**Rationale**:
- `date-fns` is tree-shakable, pure, plays well with TypeScript and Server Components.
- The month key is a derived field stored on the payment/expense document, so reads can filter by it without date math at query time.
- All "today" defaults in the UI use the browser's local zone — same assumption as the spec.

**Alternatives considered**:
- `dayjs`: comparable, but date-fns has better TypeScript inference in 2025.
- Native `Intl.DateTimeFormat`: insufficient for stepping months and formatting for the `YYYY-MM` key.

---

## 9. Form validation

**Decision**: React Hook Form 7 + Zod 3. Zod schema is the single source of truth — used by both the form (via `@hookform/resolvers/zod`) and the service layer (the service rejects writes whose payload doesn't parse).

**Rationale**:
- shadcn/ui's `Form` primitive is built on RHF + Zod — it's the path of least resistance.
- Zod schemas double as runtime guards in the service layer, so malformed data from a misbehaving client is still rejected.
- Co-locate schemas in `src/lib/schemas/` and import from both the form and the service.

**Alternatives considered**:
- Yup: comparable, but Zod's TS inference is better and the shadcn ecosystem aligns.
- Plain controlled inputs: too much boilerplate for this many forms.

---

## 10. Internationalisation (i18n) — deferred

**Decision**: English-only UI for v1. Every user-facing string inlined in the component, with a `// TODO(i18n)` comment so the future extraction is mechanical.

**Rationale**:
- Per project rule: "never localise or read any arb files or plan localisation go ahead code and add a todo comment on every string localise this later".
- The single-admin user is the owner; multilingual UI is not a v1 requirement.
- All money/date display goes through `lib/utils/currency.ts` and `lib/utils/dates.ts` so when i18n is added, only string literals need extraction.

**Alternatives considered**:
- `next-intl` from day one: rejected by project rule.
- Crowdin / Lokalise integration: not warranted for one admin in one language.

---

## 11. Hosting and CI

**Decision**: Vercel for the Next.js app (auto-deploy on push to main, preview deploys on PRs). Firebase Hosting is NOT used — Vercel serves the app, Firebase only stores data + auth. No separate CI; Vercel's build step runs `pnpm typecheck && pnpm test && pnpm build`.

**Rationale**:
- `main spec.md` header pins Vercel (free) + Firebase Spark (free).
- Vercel preview deploys are free and let us run E2E against the Firestore emulator before merge.
- No CI is needed for v1 — Vercel's build step covers typecheck + test + build.

**Alternatives considered**:
- Firebase Hosting for the app: loses the preview-deploy workflow, no Next.js image optimisation out of the box.
- GitHub Actions: redundant with Vercel's build pipeline for v1.

---

## 12. Package manager

**Decision**: `pnpm` for the workspace.

**Rationale**:
- pnpm is the fastest, has the cleanest lockfile, and is the de-facto default for new Next.js 15 projects in 2026.
- Vercel detects pnpm automatically.

**Alternatives considered**:
- npm: works, but slower installs and worse monorepo story.
- yarn (classic / berry): extra config for Next 15, no upside.
- bun: too new for production use in 2026-06; lockfile ecosystem still maturing.

---

## Summary of NEEDS CLARIFICATION status

| Item | Status | Decision |
|---|---|---|
| Language/Version | RESOLVED | TypeScript 5 + Next.js 15 + React 19, Node 20 |
| Primary Dependencies | RESOLVED | See plan §Technical Context |
| Storage | RESOLVED | Firestore (Spark) + composite indexes per `data-model.md` §11 |
| Testing | RESOLVED | Vitest 2 + Playwright 1, Firestore emulator |
| Target Platform | RESOLVED | Vercel (Node 20) + Firebase Spark |
| Project Type | RESOLVED | Single Next.js 15 app |
| Performance Goals | RESOLVED | Per SC-001 to SC-012, live via `onSnapshot` |
| Constraints | RESOLVED | Spark quotas, free-tier, English-only, single TZ |
| Scale/Scope | RESOLVED | Tens of households, hundreds of families, thousands of payments |
