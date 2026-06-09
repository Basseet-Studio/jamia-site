# Veeramangalam Juma Masjid — Household Finance Dashboard

Single-admin web dashboard for tracking monthly family contributions, expenses,
and an all-time "money on hand" balance.

## Tech

- Next.js 16 (App Router) + React 19 + TypeScript 5
- Firebase (Auth + Firestore) — Google sign-in + admin allow-list
- Tailwind 4 + shadcn/ui (Radix) — UI primitives
- React Hook Form 7 + Zod 4 — forms + service-layer guards
- date-fns 4 — month key (`YYYY-MM`)
- Vitest 3 — unit + service tests
- Playwright 1 — E2E on critical flows

## Quickstart

See `specs/001-household-finance-dashboard/quickstart.md` for the
five-minute setup (clone, install, Firebase project, env, seed, run).

## Scripts

- `npm run dev` — local dev server
- `npm run build` / `npm start` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright (needs `npm run emulators:start`)
- `npm run emulators:start` — Firestore + Auth emulators
- `npm run seed:settings` — writes `settings/global` defaults

## Deploy

Vercel auto-deploys on push. Required env vars (same as `.env.local`):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Then in a one-off shell: `firebase deploy --only firestore:rules,firestore:indexes`.

## Spec & contracts

- Spec: `specs/001-household-finance-dashboard/spec.md`
- Data model: `specs/001-household-finance-dashboard/data-model.md`
- Plan + decisions: `specs/001-household-finance-dashboard/plan.md`
- Research: `specs/001-household-finance-dashboard/research.md`
- Tasks: `specs/001-household-finance-dashboard/tasks.md`
- Service interface: `specs/001-household-finance-dashboard/contracts/service-interface.ts`
- Firestore rules (source of truth): `specs/001-household-finance-dashboard/contracts/firestore.rules` (mirrored to `firestore.rules` at repo root for `firebase deploy`)

## Architecture

- UI never calls Firebase directly. All writes go through `src/lib/services/*`
  which keep business invariants (soft-delete, family ID reservation,
  money-on-hand formula, month-key derivation) in one testable place.
- Live data: every screen subscribes via `onSnapshot` (no TanStack Query).
- Money on hand is a running total field on `settings/global`, updated
  atomically via `runTransaction` to avoid races (Note B).
- Household cascade delete uses chunked batches of 500 (Note A).
- i18n deferred — every user-facing string tagged with `// TODO(i18n)`.
