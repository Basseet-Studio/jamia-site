"use client";
/**
 * LogPaymentCard — dashboard card that lets an admin record a payment
 * directly from the dashboard without navigating into a household.
 *
 * Flow:
 *   1. Admin picks a household from the first dropdown.
 *   2. The card subscribes to that household's families and shows them in
 *      the second dropdown (active families only — removed families are hidden).
 *   3. Admin picks a family and clicks "Log payment".
 *   4. The existing <RecordPaymentDialog> opens in controlled mode so all of
 *      its over-limit preview / coverage logic is reused without duplication.
 *
 * Remount strategy: <RecordPaymentDialog> is keyed by familyId so its
 * react-hook-form defaultValues reset whenever the chosen family changes.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { subscribeHouseholds } from "@/lib/services/households";
import { subscribeFamilies } from "@/lib/services/families";
import type { Family, Household } from "@/lib/types";
import { useT } from "@/lib/i18n";

export function LogPaymentCard() {
  const t = useT();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string>("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [familyId, setFamilyId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Subscribe to all households once.
  useEffect(() => {
    const off = subscribeHouseholds((data) => {
      // Sort by name for a predictable dropdown order.
      const sorted = [...data].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
      setHouseholds(sorted);
      setHouseholdsLoading(false);
    });
    return off;
  }, []);

  // When the household changes, re-subscribe to that household's families and
  // reset the family selection.
  useEffect(() => {
    if (!householdId) {
      setFamilies([]);
      setFamilyId("");
      return;
    }
    setFamiliesLoading(true);
    setFamilyId("");
    const off = subscribeFamilies(householdId, (data) => {
      // Only show active families in the dropdown. Inactive/removed families
      // are still in the DB but shouldn't be selectable from the dashboard.
      const active = data
        .filter((f) => f.active !== false)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
      setFamilies(active);
      setFamiliesLoading(false);
    });
    return off;
  }, [householdId]);

  const selectedFamily = useMemo(
    () => families.find((f) => f.id === familyId) ?? null,
    [families, familyId],
  );
  const selectedHousehold = useMemo(
    () => households.find((h) => h.id === householdId) ?? null,
    [households, householdId],
  );

  const canLogPayment = !!selectedFamily && !!selectedHousehold;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("dashboard.logPaymentTitle")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.logPaymentDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {householdsLoading ? (
          <p className="text-sm text-muted-foreground">
            {/* Reuse the families loading key — same idea, awaiting data */}
            {t("dashboard.loadingFamilies")}
          </p>
        ) : households.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("dashboard.noHouseholds")}
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="log-pay-household">
                  {t("dashboard.selectHousehold")}
                </Label>
                <Select
                  value={householdId || undefined}
                  onValueChange={(v) => setHouseholdId(v)}
                >
                  <SelectTrigger id="log-pay-household" className="w-full">
                    <SelectValue
                      placeholder={t("dashboard.selectHousehold")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {households.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-pay-family">
                  {t("dashboard.selectFamily")}
                </Label>
                <Select
                  value={familyId || undefined}
                  onValueChange={(v) => setFamilyId(v)}
                  disabled={!householdId}
                >
                  <SelectTrigger id="log-pay-family" className="w-full">
                    <SelectValue
                      placeholder={
                        !householdId
                          ? t("dashboard.selectHousehold")
                          : familiesLoading
                            ? t("dashboard.loadingFamilies")
                            : t("dashboard.selectFamily")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {families.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        {t("dashboard.noFamilies")}
                      </SelectItem>
                    ) : (
                      families.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!canLogPayment}
                onClick={() => setDialogOpen(true)}
              >
                {t("dashboard.logPaymentButton")}
              </Button>
            </div>
            {/* Reuse the existing dialog. Keyed by familyId so its form
                defaults reset when the admin switches family selection. */}
            {canLogPayment && selectedFamily && selectedHousehold ? (
              <RecordPaymentDialog
                key={selectedFamily.id}
                householdId={selectedHousehold.id}
                familyId={selectedFamily.id}
                familyName={selectedFamily.name}
                hideTrigger
                open={dialogOpen}
                onOpenChange={setDialogOpen}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}