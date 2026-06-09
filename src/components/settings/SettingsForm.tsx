"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from "@/lib/schemas/setting";
import { subscribeSettings, updateSettings } from "@/lib/services/settings";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpeningBalanceWarning } from "@/components/settings/OpeningBalanceWarning";
import { useT } from "@/lib/i18n";
import type { Setting } from "@/lib/types";

export function SettingsForm() {
  const { user } = useAuth();
  const t = useT();
  const [current, setCurrent] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<{
    open: boolean;
    values: UpdateSettingsInput | null;
  }>({
    open: false,
    values: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const off = subscribeSettings((s) => {
      setCurrent(s);
      setLoading(false);
      if (s) form.reset(s);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      defaultContributionTarget: 0,
      openingBalance: 0,
      currency: "",
    },
  });

  async function commit(values: UpdateSettingsInput) {
    if (!user) return;
    setError(null);
    setSaved(false);
    try {
      await updateSettings(user.uid, values);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onSubmit(values: UpdateSettingsInput) {
    if (!current) return;
    if (
      values.openingBalance !== undefined &&
      values.openingBalance !== current.openingBalance
    ) {
      setWarning({ open: true, values });
      return;
    }
    commit(values);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.globalSettings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="set-target">
                  {t("settings.defaultTarget")}
                </Label>
                <Input
                  id="set-target"
                  type="number"
                  min={0}
                  {...form.register("defaultContributionTarget", {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="set-opening">
                  {t("settings.openingBalance")}
                </Label>
                <Input
                  id="set-opening"
                  type="number"
                  step="0.01"
                  {...form.register("openingBalance", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.openingBalanceHelper")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="set-currency">{t("settings.currency")}</Label>
                <Input
                  id="set-currency"
                  maxLength={8}
                  {...form.register("currency")}
                  placeholder={current?.currency ?? "AED"}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              {saved ? (
                <p className="text-sm text-emerald-700">
                  {t("settings.saved")}
                </p>
              ) : null}
              <Button type="submit">{t("settings.saveSettings")}</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <OpeningBalanceWarning
        open={warning.open}
        onOpenChange={(o) => setWarning((s) => ({ ...s, open: o }))}
        previousValue={current?.openingBalance ?? 0}
        nextValue={
          warning.values?.openingBalance ?? current?.openingBalance ?? 0
        }
        currency={current?.currency ?? ""}
        onConfirm={async () => {
          if (warning.values) await commit(warning.values);
          setWarning({ open: false, values: null });
        }}
      />
    </div>
  );
}
