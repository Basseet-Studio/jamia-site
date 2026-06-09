"use client";
import { useEffect, useState } from "react";
import { subscribeHouseholds } from "@/lib/services/households";
import { AddHouseholdDialog } from "@/components/households/AddHouseholdDialog";
import { DeleteHouseholdDialog } from "@/components/households/DeleteHouseholdDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import type { Household } from "@/lib/types";

export default function HouseholdsPage() {
  const [list, setList] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeHouseholds((rows) => {
      setList(rows);
      setLoading(false);
    });
    return off;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Households</h1>
        <AddHouseholdDialog />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No households yet. Add one to get started.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((h) => {
            const created = h.createdAt?.toDate ? h.createdAt.toDate() : null;
            return (
              <Card key={h.id}>
                <CardHeader>
                  <CardTitle>
                    <a href={`/households/${h.id}`} className="hover:underline">
                      {h.name}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{created ? `Created ${format(created, "yyyy-MM-dd")}` : "—"}</span>
                  <DeleteHouseholdDialog householdId={h.id} householdName={h.name} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
