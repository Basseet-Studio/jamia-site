Note A — Household cascade delete batch limit (T085)
Firestore batches cap at 500 operations. A household with many families and years of payments will exceed this. When we get to T085, split the cascade into chunked batches of 500 rather than one single WriteBatch.
Note B — Money on hand race condition (T025)
The running total on settings/global must be updated inside a runTransaction, not a plain batch write. Two admins writing simultaneously will corrupt the total if both read the old value before either writes. When we get to T025, every moneyOnHand mutation goes through runTransaction.
Note C — Phase ordering: US13 before US12 (Phase 15 before Phase 14)
The phase numbering has US12 (P3) before US13 (P2). The dependency graph is correct — US13 only needs US5. When we reach the P2/P3 sprint, do US13 (all-time expenses toggle) before US12 (month nav + global nav).
