"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createFamilySchema, type CreateFamilySchema } from "@/lib/schemas/family";
import { createFamily } from "@/lib/services/families";
import { subscribeSettings } from "@/lib/services/settings";
import { useAuth } from "@/lib/hooks/useAuth";

export function AddFamilyDialog({ householdId }: { householdId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [defaultTarget, setDefaultTarget] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const off = subscribeSettings((s) => setDefaultTarget(s?.defaultContributionTarget ?? null));
    return off;
  }, [open]);

  const form = useForm<CreateFamilySchema>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: { householdId, name: "", contributionTarget: 0 },
  });

  // When settings load, prefill the target unless the user already typed.
  useEffect(() => {
    if (defaultTarget !== null && !form.getValues("contributionTarget")) {
      form.setValue("contributionTarget", defaultTarget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTarget, open]);

  async function onSubmit(values: CreateFamilySchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createFamily(user.uid, values);
      form.reset({ householdId, name: "", contributionTarget: defaultTarget ?? 0 });
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
        <Button>
          {/* TODO(i18n): button label */}
          Add family
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): dialog title */}
            Add family
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fam-name">
              {/* TODO(i18n): label */}
              Name
            </Label>
            <Input id="fam-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fam-target">
              {/* TODO(i18n): label */}
              Monthly contribution target
            </Label>
            <Input
              id="fam-target"
              type="number"
              min={0}
              {...form.register("contributionTarget", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              {/* TODO(i18n): helper text */}
              Defaults to the global setting. You can override per family.
            </p>
            {form.formState.errors.contributionTarget ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.contributionTarget.message}
              </p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {/* TODO(i18n): cancel */}
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
              {/* TODO(i18n): save label */}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
