"use client";
import { use, useEffect, useMemo, useState } from "react";
import { subscribeFamilies } from "@/lib/services/families";
import { subscribeFamilyMonthlyStatuses } from "@/lib/services/derived";
import { subscribeHousehold } from "@/lib/services/households";
import { AddFamilyDialog } from "@/components/households/AddFamilyDialog";
import { FamilyRow } from "@/components/households/FamilyRow";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { currentMonthKey, toMonthKey } from "@/lib/utils/dates";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Family, FamilyMonthlySummary, Household } from "@/lib/types";

export default function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = use(params);
  const [household, setHousehold] = useState<Household | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [statuses, setStatuses] = useState<FamilyMonthlySummary[]>([]);
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeHousehold(householdId, (h) => {
      setHousehold(h);
      setLoading(false);
    });
    return off;
  }, [householdId]);

  useEffect(() => {
    const off = subscribeFamilies(householdId, setFamilies);
    return off;
  }, [householdId]);

  useEffect(() => {
    const off = subscribeFamilyMonthlyStatuses(householdId, month, setStatuses);
    return off;
  }, [householdId, month]);

  const statusById = useMemo(() => {
    const m = new Map<string, FamilyMonthlySummary>();
    statuses.forEach((s) => m.set(s.familyId, s));
    return m;
  }, [statuses]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!household) {
    return <p className="text-sm text-muted-foreground">Household not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{household.name}</h1>
        <div className="flex items-center gap-3">
          <MonthNavigator month={month} onChange={setMonth} />
          <AddFamilyDialog householdId={householdId} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Families</CardTitle>
        </CardHeader>
        <CardContent>
          {families.length === 0 ? (
            <p className="text-sm text-muted-foreground">No families yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Paid ({toMonthKey(new Date(month + "-01"))})</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {families.map((f) => (
                  <FamilyRow
                    key={f.id}
                    householdId={householdId}
                    family={f}
                    status={statusById.get(f.id) ?? null}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {families
              .filter((f) => f.active)
              .map((f) => (
                <RecordPaymentDialog
                  key={f.id}
                  householdId={householdId}
                  familyId={f.id}
                  familyName={f.name}
                />
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
