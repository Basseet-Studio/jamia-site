ohamedelobaid@MacMini ios % cd /Volumes/abdelhag/baseet/jamia/jamia-site
mohamedelobaid@MacMini jamia-site % npx tsc --noEmit 2>&1 | tee /tmp/tc.log | head -200
src/components/households/MembersSection.tsx(42,42): error TS2322: Type 'string' is not assignable to type 'never'.
src/lib/services/dashboardData.ts(27,13): error TS2322: Type '{ household: { id: string; name: string; createdAt: Timestamp; createdBy: string; }; summary: null; }[]' is not assignable to type 'HouseholdSummary[]'.
  Type '{ household: { id: string; name: string; createdAt: Household["createdAt"]; createdBy: string; }; summary: null; }' is not assignable to type 'HouseholdSummary'.
    Types of property 'household' are incompatible.
      Type '{ id: string; name: string; createdAt: Timestamp; createdBy: string; }' is missing the following properties from type 'Household': memberCount, memberNames, updatedAt, updatedBy
src/lib/services/expenses.ts(108,47): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Record<string, unknown>'.
src/lib/services/expenses.ts(122,51): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Record<string, unknown>'.
tests/unit/services/shortfall.test.ts(29,32): error TS2345: Argument of type '{ recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(37,32): error TS2345: Argument of type '{ recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(44,32): error TS2345: Argument of type '{ recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(51,32): error TS2345: Argument of type '{ recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(58,32): error TS2345: Argument of type '{ recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(65,32): error TS2345: Argument of type '{ moneyOnHandAtStartOfMonth: number; recurringTotal: number; month: "2026-06"; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(76,32): error TS2345: Argument of type '{ recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; paymentsThisMonth: 0; withdrawnExpensesThisMonth: 0; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON
tests/unit/services/shortfall.test.ts(83,32): error TS2345: Argument of type '{ paymentsThisMonth: number; withdrawnExpensesThisMonth: number; recurringTotal: number; month: "2026-06"; moneyOnHandAtStartOfMonth: 1000; asOf: FieldValue; }' is not assignable to parameter of type 'ComputeShortfallInput'.
  Types of property 'asOf' are incompatible.
    Type 'FieldValue' is missing the following properties from type 'Timestamp': seconds, nanoseconds, toDate, toMillis, toJSON





    mohamedelobaid@MacMini jamia-site % npx vitest run 2>&1 | tee /tmp/vitest.log | tail -150
    
     RUN  v3.2.6 /Volumes/abdelhag/baseet/jamia/jamia-site
    
     ✓ tests/unit/quickstart.test.ts (8 tests) 2ms
     ✓ tests/unit/utils/currency.test.ts (7 tests) 40ms
     ✓ tests/unit/schemas.test.ts (6 tests) 5ms
     ✓ tests/unit/services/settings.test.ts (1 test) 1ms
     ✓ tests/unit/services/families.test.ts (3 tests | 2 skipped) 5ms
     ✓ tests/unit/ui/toast.test.tsx (7 tests) 266ms
     ✓ tests/unit/ui/form.test.tsx (5 tests) 269ms
     ✓ tests/unit/schemas/expense.discriminatedUnion.test.ts (7 tests) 8ms
     ✓ tests/unit/services/moneyOnHand.test.ts (2 tests | 1 skipped) 5ms
     ✓ tests/unit/utils/dates.test.ts (9 tests) 5ms
     ✓ tests/unit/services/shortfall.test.ts (10 tests) 5ms
     ✓ tests/unit/services/households.updateMembers.test.ts (3 tests) 3ms
     ✓ tests/unit/services/households.delete.test.ts (2 tests) 1ms
     ✓ tests/unit/services/households.test.ts (1 test) 5ms
     ✓ tests/unit/services/recurring.test.ts (2 tests) 2ms
     ✓ tests/unit/helpers/seed.test.ts (2 tests | 1 skipped) 1ms
     ✓ tests/unit/services/expenses.createType.test.ts (3 tests) 3ms
     ✓ tests/unit/services/payments.test.ts (2 tests) 1ms
     ✓ tests/unit/services/calendarView.test.ts (1 test) 2ms
     ✓ tests/unit/services/expenses.test.ts (2 tests) 1ms
    
     Test Files  20 passed (20)
          Tests  79 passed | 4 skipped (83)
       Start at  14:53:46
       Duration  3.76s (transform 550ms, setup 3.17s, collect 10.44s, tests 630ms, environment 10.80s, prepare 1.45s)
    
