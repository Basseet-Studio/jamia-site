"use client";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { useContributions } from "@/lib/hooks/useContributions";
import {
  contributionSchema,
  type ContributionSchema,
} from "@/lib/schemas/contribution";
import {
  addContribution,
  deleteContribution,
} from "@/lib/services/contributions";
import { formatCurrency } from "@/lib/utils/currency";

export default function ContributionsPage() {
  const { user } = useAuth();
  const { moh } = useMoneyOnHand();
  const { contributions, loading, error } = useContributions();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = moh.currency || "AED";
  const total = useMemo(
    () => contributions.reduce((sum, item) => sum + item.amount, 0),
    [contributions],
  );
  const form = useForm<ContributionSchema>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      contributorName: "",
      amount: 0,
      date: new Date(),
      note: null,
    },
  });

  async function onSubmit(values: ContributionSchema) {
    if (!user) return;
    setBusy(true);
    try {
      await addContribution(user.uid, values);
      form.reset({
        contributorName: "",
        amount: 0,
        date: new Date(),
        note: null,
      });
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    // TODO: localise this later
    if (!confirm("Delete this contribution?")) return;
    await deleteContribution(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {/* TODO: localise this later */}
          Contributions
        </h1>
        <Button onClick={() => setShowForm((value) => !value)}>
          {/* TODO: localise this later */}
          Add Contribution
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            {/* TODO: localise this later */}
            <CardTitle>Total Contributed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(total, cur)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            {/* TODO: localise this later */}
            <CardTitle>Records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {contributions.length}
          </CardContent>
        </Card>
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            {/* TODO: localise this later */}
            <CardTitle>New Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contributorName">
                    {/* TODO: localise this later */}
                    Contributor name
                  </Label>
                  <Input id="contributorName" {...form.register("contributorName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">
                    {/* TODO: localise this later */}
                    Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step="0.01"
                    {...form.register("amount", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">
                    {/* TODO: localise this later */}
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={format(form.watch("date"), "yyyy-MM-dd")}
                    onChange={(event) => {
                      if (event.target.value) {
                        form.setValue("date", new Date(event.target.value));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">
                    {/* TODO: localise this later */}
                    Note
                  </Label>
                  <Textarea id="note" {...form.register("note")} maxLength={280} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  {/* TODO: localise this later */}
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {/* TODO: localise this later */}
                  {busy ? "Saving..." : "Save Contribution"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">
          {/* TODO: localise this later */}
          Loading...
        </p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : contributions.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {/* TODO: localise this later */}
          No contributions recorded yet.
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {contributions.map((item) => {
            const date = item.date?.toDate ? item.date.toDate() : new Date();
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 p-3"
              >
                <div>
                  <div className="font-medium">{item.contributorName}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(date, "yyyy-MM-dd")}
                    {item.note ? ` · ${item.note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-medium tabular-nums">
                    {formatCurrency(item.amount, cur)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    {/* TODO: localise this later */}
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
