"use client";
/**
 * AdminManagement — full self-service admin roster inside Settings.
 *
 * Admins can:
 *  - See the full list of admins (live)
 *  - Promote a new admin by their UID (the typical "share access with a
 *    fellow trustee" flow). The owner's display name + role default to
 *    sensible values; the caller picks the role.
 *  - Demote an existing admin (with confirmation). Refuses if it would
 *    leave the collection empty, and refuses to demote yourself.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import {
  demoteAdmin,
  promoteToAdmin,
  subscribeAdmins,
} from "@/lib/services/admins";
import type { Admin, AdminRole } from "@/lib/types";

export function AdminManagement() {
  const { user: currentUser } = useAuth();
  const t = useT();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = subscribeAdmins((rows) => {
      setAdmins(rows);
      setLoading(false);
    });
    return off;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("adminManagement.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("adminManagement.body")}
        </p>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : (
          <AdminTable
            admins={admins}
            currentUid={currentUser?.uid ?? null}
            onError={setError}
            onCleared={() => setError(null)}
          />
        )}
        <PromoteAdminDialog onError={setError} onSuccess={() => setError(null)} />
      </CardContent>
    </Card>
  );
}

function AdminTable({
  admins,
  currentUid,
  onError,
  onCleared,
}: {
  admins: Admin[];
  currentUid: string | null;
  onError: (msg: string) => void;
  onCleared: () => void;
}) {
  const t = useT();
  if (admins.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("adminManagement.empty")}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left font-medium">
              {t("adminManagement.tableName")}
            </th>
            <th className="px-3 py-2 text-left font-medium">
              {t("adminManagement.tableEmail")}
            </th>
            <th className="px-3 py-2 text-left font-medium">
              {t("adminManagement.tableRole")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("common.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => {
            const isSelf = a.uid === currentUid;
            return (
              <tr key={a.uid} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {a.displayName}
                  {isSelf ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({t("adminManagement.you")})
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {a.email}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
                    {a.role}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <DemoteAdminButton
                    admin={a}
                    isSelf={isSelf}
                    onError={onError}
                    onCleared={onCleared}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DemoteAdminButton({
  admin,
  isSelf,
  onError,
  onCleared,
}: {
  admin: Admin;
  isSelf: boolean;
  onError: (msg: string) => void;
  onCleared: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("adminManagement.cantRemoveSelf")}
      </span>
    );
  }

  const matches = confirmText.trim() === admin.email;

  async function onConfirm() {
    if (!matches) return;
    setBusy(true);
    onCleared();
    try {
      await demoteAdmin(admin.uid);
      setOpen(false);
      setConfirmText("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
        >
          {t("adminManagement.removeButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("adminManagement.removeTitle", { name: admin.displayName })}
          </DialogTitle>
          <DialogDescription>
            {t("adminManagement.removeBody", { email: admin.email })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-email">
            {t("adminManagement.removeConfirmLabel")}
          </Label>
          <Input
            id="confirm-email"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={admin.email}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || busy}
          >
            {busy ? t("common.deleting") : t("adminManagement.removeAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromoteAdminDialog({
  onError,
  onSuccess,
}: {
  onError: (msg: string) => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");

  function reset() {
    setUid("");
    setEmail("");
    setDisplayName("");
    setRole("admin");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid.trim()) return;
    setBusy(true);
    onSuccess();
    try {
      await promoteToAdmin(uid.trim(), {
        email: email.trim(),
        displayName: displayName.trim() || email.trim() || uid.trim(),
        role,
      });
      reset();
      setOpen(false);
    } catch (e2) {
      onError((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>{t("adminManagement.promoteButton")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("adminManagement.promoteTitle")}</DialogTitle>
          <DialogDescription>
            {t("adminManagement.promoteBody")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adm-uid">{t("adminManagement.fieldUid")}</Label>
            <Input
              id="adm-uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("adminManagement.fieldUidHelp")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-email">{t("adminManagement.fieldEmail")}</Label>
            <Input
              id="adm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-name">{t("adminManagement.fieldName")}</Label>
            <Input
              id="adm-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-role">{t("adminManagement.fieldRole")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger id="adm-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">owner</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("adminManagement.promoteAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
