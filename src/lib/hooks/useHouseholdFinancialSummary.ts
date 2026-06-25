"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { subscribeFamilies } from "@/lib/services/families";
import { subscribePayments } from "@/lib/services/payments";
import { deriveHouseholdFinancialSummary } from "@/lib/services/derived";
import type { Expense, Family, Payment } from "@/lib/types";

function toExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    name: String(data.name ?? ""),
    amount: typeof data.amount === "number" ? data.amount : 0,
    date: data.date as Expense["date"],
    month: String(data.month ?? ""),
    note: (data.note as Expense["note"]) ?? null,
    isRecurring: data.isRecurring === true,
    recurringId: (data.recurringId as Expense["recurringId"]) ?? null,
    withdrawn: data.withdrawn === true,
    withdrawnAt: (data.withdrawnAt as Expense["withdrawnAt"]) ?? null,
    withdrawnBy: (data.withdrawnBy as Expense["withdrawnBy"]) ?? null,
    addedAt: data.addedAt as Expense["addedAt"],
    addedBy: String(data.addedBy ?? ""),
    type: "household",
    householdId: (data.householdId as string | undefined) ?? null,
    familyId: (data.familyId as string | undefined) ?? null,
    mosqueSubCategory: null,
  };
}

export function useHouseholdFinancialSummary(householdId: string): {
  totalContributions: number;
  totalExpenses: number;
  net: number;
} {
  const [families, setFamilies] = useState<Family[]>([]);
  const [paymentsByFamily, setPaymentsByFamily] = useState<
    Record<string, Payment[]>
  >({});
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => subscribeFamilies(householdId, setFamilies), [householdId]);

  useEffect(() => {
    setPaymentsByFamily({});
    const unsubs = families.map((family) =>
      subscribePayments(householdId, family.id, (payments) => {
        setPaymentsByFamily((current) => ({
          ...current,
          [family.id]: payments,
        }));
      }),
    );
    return () => unsubs.forEach((off) => off());
  }, [families, householdId]);

  useEffect(() => {
    const ref = query(
      collection(getDb(), "expenses"),
      where("type", "==", "household"),
      where("householdId", "==", householdId),
      where("withdrawn", "==", false),
    );
    return onSnapshot(ref, (snap) => {
      setExpenses(
        snap.docs.map((d) => toExpense(d.id, d.data() as Record<string, unknown>)),
      );
    });
  }, [householdId]);

  return deriveHouseholdFinancialSummary(
    Object.values(paymentsByFamily).flat(),
    expenses,
  );
}
