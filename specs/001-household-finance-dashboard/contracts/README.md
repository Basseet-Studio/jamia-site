# Contracts

The "contracts" folder holds the formal access and interface contracts that this app exposes and consumes. There is no REST/GraphQL API surface — the app talks directly to Firestore from the client and from Server Actions. So the contracts here are:

- `firestore.rules` — the access contract. Defines who can read and write each collection.
- `service-interface.ts` — the service layer TypeScript interface. Defines what the UI calls, and what the implementation must guarantee.

## Why this structure

For a single-tenant, single-admin dashboard backed by Firestore:

- **Firestore Security Rules** are the only place that can deny access server-side. SC-006 ("unauthorised user cannot retrieve any data") depends entirely on rules. Client-side guards are UX, not security.
- **Service interface** is the only place that defines business invariants (soft-delete, family ID reservation, money-on-hand formula, month-key derivation) in one place. The UI never touches Firestore directly; it calls the service. This makes invariants testable and keeps the UI thin.

## Mirroring at repo root

`firebase.json` deploys `./firestore.rules` and `./firestore.indexes.json` from the **repo root** (`firebase deploy --only firestore:rules,firestore:indexes`). Keep the copies in this folder in sync with those root files so design/review docs match what actually ships.

## Deployment

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Both `firestore.rules` and `firestore.indexes.json` are deployed from the **repo root**. Keep this folder’s copies aligned with those files.

## How to extend

When you add a new entity:

1. Add the entity type to `service-interface.ts` (TypeScript types + interface methods).
2. Add the collection path to `firestore.rules` (read for admin, write with the schema you want to enforce).
3. Add a composite index to `firestore.indexes.json` if any new query is non-trivial.
4. Add a Zod schema in `src/lib/schemas/`.
5. Implement the service method in `src/lib/services/`.
