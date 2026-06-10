"use client";
import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  householdMemberSchema,
  type HouseholdMemberSchema,
} from "@/lib/schemas/householdMember";
import { updateMembers } from "@/lib/services/households";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import type { Household } from "@/lib/types";

export function MembersSection({ household }: { household: Household }) {
  const { user } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<HouseholdMemberSchema>({
    resolver: zodResolver(householdMemberSchema),
    defaultValues: {
      memberCount: household.memberCount,
      memberNames:
        household.memberNames.length > 0 ? household.memberNames : [""],
    },
  });
  const { control, handleSubmit, watch, setValue, reset } = form;
  const names = useFieldArray({ control, name: "memberNames" });

  // Keep memberCount in sync with the array length (FR-003).
  const watchedNames = watch("memberNames");
  useEffect(() => {
    const len = Array.isArray(watchedNames) ? watchedNames.length : 0;
    if (len !== form.getValues("memberCount")) {
      setValue("memberCount", len, { shouldValidate: true });
    }
  }, [watchedNames, setValue, form]);

  // Reset the form when the dialog opens so a fresh edit always starts
  // from the current household values.
  useEffect(() => {
    if (open) {
      reset({
        memberCount: household.memberCount,
        memberNames:
          household.memberNames.length > 0 ? household.memberNames : [""],
      });
    }
  }, [open, household, reset]);

  async function onSubmit(values: HouseholdMemberSchema) {
    if (!user) return;
    // Strip empty names; final count = filtered length.
    const cleaned = values.memberNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (cleaned.length !== values.memberCount) {
      setValue("memberCount", cleaned.length);
    }
    setBusy(true);
    setError(null);
    try {
      await updateMembers(user.uid, household.id, {
        memberCount: cleaned.length,
        memberNames: cleaned,
      });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("householdMembers.sectionTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("householdMembers.count", { count: household.memberCount })}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/households/${household.id}/history`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {t("householdMembers.historyLink")}
            </Link>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  {t("householdMembers.edit")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("householdMembers.title")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    {names.fields.map((field, i) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <Controller
                          control={control}
                          name={`memberNames.${i}`}
                          render={({ field: f }) => (
                            <Input
                              {...f}
                              placeholder={t(
                                "householdMembers.namePlaceholder",
                              )}
                            />
                          )}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => names.remove(i)}
                          disabled={names.fields.length === 0}
                        >
                          {t("householdMembers.remove")}
                        </Button>
                      </div>
                    ))}
                    {form.formState.errors.memberNames ? (
                      <p className="text-xs text-destructive">
                        {(
                          form.formState.errors.memberNames as {
                            message?: string;
                          }
                        )?.message ?? t("householdMembers.invalidCount")}
                      </p>
                    ) : null}
                    {form.formState.errors.memberCount ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.memberCount.message}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => names.append("")}
                  >
                    {t("householdMembers.add")}
                  </Button>
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                    >
                      {t("householdMembers.cancel")}
                    </Button>
                    <Button type="submit" disabled={busy}>
                      {busy ? t("common.saving") : t("householdMembers.save")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
