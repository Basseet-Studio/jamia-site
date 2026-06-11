"use client";
/**
 * FamilyMembersDialog — manage a family's member census.
 * Hierarchy: household -> family -> members.
 *
 * The dialog also links to the per-family member-history view.
 */
import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  familyMemberSchema,
  type FamilyMemberSchema,
} from "@/lib/schemas/familyMember";
import { updateMembers } from "@/lib/services/families";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import type { Family } from "@/lib/types";

export function FamilyMembersDialog({
  householdId,
  family,
}: {
  householdId: string;
  family: Family;
}) {
  const { user } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FamilyMemberSchema>({
    resolver: zodResolver(familyMemberSchema),
    defaultValues: {
      memberCount: family.memberCount,
      memberNames: family.memberNames.length > 0 ? family.memberNames : [""],
    },
  });
  const { control, handleSubmit, watch, setValue, reset } = form;
  // useFieldArray's element type inference can resolve to `never` when the
  // form schema is built from a zod object — cast the array to the
  // expected shape so the field ids keep their `string` type.
  const names = useFieldArray({
    control,
    name: "memberNames" as never,
  }) as unknown as {
    fields: { id: string }[];
    append: (v: string) => void;
    remove: (i: number) => void;
  };

  // Keep memberCount in sync with the array length.
  const watchedNames = watch("memberNames");
  useEffect(() => {
    const len = Array.isArray(watchedNames) ? watchedNames.length : 0;
    if (len !== form.getValues("memberCount")) {
      setValue("memberCount", len, { shouldValidate: true });
    }
  }, [watchedNames, setValue, form]);

  // Reset the form when the dialog opens so a fresh edit always starts
  // from the current family values.
  useEffect(() => {
    if (open) {
      reset({
        memberCount: family.memberCount,
        memberNames: family.memberNames.length > 0 ? family.memberNames : [""],
      });
    }
  }, [open, family, reset]);

  async function onSubmit(values: FamilyMemberSchema) {
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
      await updateMembers(user.uid, householdId, family.id, {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("families.membersButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("householdMembers.title")}</DialogTitle>
          <DialogDescription>
            {t("householdMembers.dialogDescription", { name: family.name })}
          </DialogDescription>
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
                      placeholder={t("householdMembers.namePlaceholder")}
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
        <div className="text-xs text-muted-foreground">
          <Link
            href={`/households/${householdId}/families/${family.id}/members-history`}
            className="hover:underline"
          >
            {t("householdMembers.historyLink")}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
