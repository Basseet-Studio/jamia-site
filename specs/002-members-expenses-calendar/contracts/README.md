# Contracts: Household Members, Expense Types, Calendar View, Budget Shortfall

**Branch**: `002-members-expenses-calendar` | **Date**: 2026-06-10

Delta-only contracts for the 002 feature. The v1 contracts in `specs/001-household-finance-dashboard/contracts/` are NOT modified — they remain the historical record of the v1 service surface. This folder adds the 002-only types and service methods.

Files:

- `service-interface.ts` — adds new entity types (HouseholdMemberHistory, MosqueSubCategory, etc.), the 002 service method signatures (members, memberHistory, mosque-aware expense queries, budgetShortfall), and the extended `deleteHousehold` signature.
- `firestore.rules` — the DELTA of security rules to apply on top of the v1 rules. The v1 rules are mirrored to repo root unchanged; this file is patched into a single `firestore.rules` during deploy.

See also:

- `../data-model.md` — fields, validation, cascade, indexes.
- `../research.md` — rationale for each design choice.
- `../../001-household-finance-dashboard/contracts/` — v1 contract (read-only reference).
