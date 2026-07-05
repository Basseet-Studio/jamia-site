"use client";
/**
 * Debug console — live view of auth state, admin doc, and a "test ops"
 * panel so we can see exactly which Firestore call fails and why.
 *
 * This page is intentionally chatty. It is admin-gated (it sits under the
 * (app) layout, behind AuthGuard) but otherwise wide open. No mutations
 * happen unless you click a button.
 */
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import type { Family, Household } from "@/lib/types";

interface LogEntry {
  ts: string;
  level: "info" | "ok" | "err";
  msg: string;
}

export default function DebugPage() {
  const t = useT();
  const { user, admin, loading, refreshAdmin } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [probe, setProbe] = useState<{
    householdId: string;
    familyId: string;
  }>({ householdId: "", familyId: "" });
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogEntry["level"], msg: string) => {
    setLog((prev) =>
      [
        { ts: new Date().toISOString().split("T")[1].slice(0, 12), level, msg },
        ...prev,
      ].slice(0, 80),
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    addLog("info", `signed-in uid=${user.uid} email=${user.email}`);
  }, [user, addLog]);

  // Load all households (live, one-shot for the debug page).
  useEffect(() => {
    let cancelled = false;
    getDocs(collection(getDb(), "households"))
      .then((snap) => {
        if (cancelled) return;
        const list: Household[] = snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? ""),
          createdAt: d.data().createdAt as Household["createdAt"],
          createdBy: String(d.data().createdBy ?? ""),
          active: d.data().active !== false,
          deletedAt: (d.data().deletedAt as Household["deletedAt"]) ?? null,
          deletedBy: (d.data().deletedBy as Household["deletedBy"]) ?? null,
        }));
        setHouseholds(list);
        addLog("ok", `loaded ${list.length} household(s)`);
        if (list[0] && !probe.householdId) {
          setProbe((p) => ({ ...p, householdId: list[0].id }));
        }
      })
      .catch((e) =>
        addLog("err", `load households failed: ${(e as Error).message}`),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Load families in the probed household.
  useEffect(() => {
    if (!probe.householdId) {
      setFamilies([]);
      return;
    }
    let cancelled = false;
    getDocs(collection(getDb(), "households", probe.householdId, "families"))
      .then((snap) => {
        if (cancelled) return;
        const list: Family[] = snap.docs.map((d) => ({
          id: d.id,
          householdId: probe.householdId,
          name: String(d.data().name ?? ""),
          contributionTarget:
            typeof d.data().contributionTarget === "number"
              ? (d.data().contributionTarget as number)
              : 0,
          createdAt: d.data().createdAt as Family["createdAt"],
          createdBy: String(d.data().createdBy ?? ""),
          active: d.data().active !== false,
          deletedAt: (d.data().deletedAt as Family["deletedAt"]) ?? null,
          deletedBy: (d.data().deletedBy as Family["deletedBy"]) ?? null,
          memberCount:
            typeof d.data().memberCount === "number"
              ? (d.data().memberCount as number)
              : 0,
          memberNames: Array.isArray(d.data().memberNames)
            ? (d.data().memberNames as string[])
            : [],
          updatedAt: (d.data().updatedAt as Family["updatedAt"]) ?? null,
          updatedBy: (d.data().updatedBy as Family["updatedBy"]) ?? null,
        }));
        setFamilies(list);
        addLog("ok", `loaded ${list.length} families in ${probe.householdId}`);
        if (list[0] && probe.familyId === "") {
          setProbe((p) => ({ ...p, familyId: list[0].id }));
        }
      })
      .catch((e) =>
        addLog("err", `load families failed: ${(e as Error).message}`),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe.householdId]);

  async function probeRead() {
    if (!probe.householdId || !probe.familyId) return;
    try {
      addLog("info", `getDoc(family ${probe.familyId})…`);
      const snap = await getDoc(
        doc(
          getDb(),
          "households",
          probe.householdId,
          "families",
          probe.familyId,
        ),
      );
      setProbeResult(JSON.stringify(snap.data(), null, 2));
      addLog("ok", `getDoc succeeded (exists=${snap.exists()})`);
    } catch (e) {
      setProbeResult(`ERROR: ${(e as Error).message}`);
      addLog("err", `getDoc failed: ${(e as Error).message}`);
    }
  }

  async function probeSoftDelete() {
    if (!user) return;
    if (!probe.householdId || !probe.familyId) return;
    try {
      addLog("info", `updateDoc soft-delete family ${probe.familyId}…`);
      await updateDoc(
        doc(
          getDb(),
          "households",
          probe.householdId,
          "families",
          probe.familyId,
        ),
        {
          active: false,
          deletedAt: serverTimestamp(),
          deletedBy: user.uid,
        },
      );
      addLog("ok", `soft-delete succeeded`);
      setProbeResult("(soft-delete wrote; reload families to see)");
    } catch (e) {
      const err = e as Error & { code?: string };
      setProbeResult(
        `ERROR: ${err.message}\nCODE: ${err.code ?? "(none)"}\nSTACK: ${err.stack ?? "(none)"}`,
      );
      addLog(
        "err",
        `soft-delete failed: ${err.message} (code=${err.code ?? "n/a"})`,
      );
    }
  }

  async function probeAddMember() {
    if (!user) return;
    if (!probe.householdId || !probe.familyId) return;
    try {
      addLog("info", `updateDoc add members to family ${probe.familyId}…`);
      await updateDoc(
        doc(
          getDb(),
          "households",
          probe.householdId,
          "families",
          probe.familyId,
        ),
        {
          memberCount: 2,
          memberNames: ["Ahmed", "Fatima"],
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
      );
      addLog("ok", `add-member succeeded`);
      setProbeResult("(add-member wrote; reload families to see)");
    } catch (e) {
      const err = e as Error & { code?: string };
      setProbeResult(
        `ERROR: ${err.message}\nCODE: ${err.code ?? "(none)"}\nSTACK: ${err.stack ?? "(none)"}`,
      );
      addLog(
        "err",
        `add-member failed: ${err.message} (code=${err.code ?? "n/a"})`,
      );
    }
  }

  async function probeBootstrapAdmin() {
    if (!user) return;
    try {
      addLog("info", `attempting to create admins/${user.uid}…`);
      await setDoc(doc(getDb(), "admins", user.uid), {
        email: user.email ?? "",
        displayName: user.displayName ?? user.email ?? "Owner",
        role: "owner",
        addedAt: serverTimestamp(),
      });
      addLog("ok", `bootstrap admin succeeded`);
      await refreshAdmin();
    } catch (e) {
      const err = e as Error & { code?: string };
      addLog(
        "err",
        `bootstrap admin failed: ${err.message} (code=${err.code ?? "n/a"})`,
      );
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Debug console</h1>
        <p className="text-xs text-muted-foreground">
          Project: <code>jamia-674ec</code> · emulator? <code>off</code>
        </p>
      </div>

      <CardTitle> App version 1.0.0.6 </CardTitle>
      <Card>
        <CardHeader>
          <CardTitle>Auth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <KV k="uid" v={user?.uid ?? "—"} />
          <KV k="email" v={user?.email ?? "—"} />
          <KV k="displayName" v={user?.displayName ?? "—"} />
          <KV
            k="admin doc"
            v={
              admin
                ? `present (role=${admin.role}, email=${admin.email})`
                : "MISSING"
            }
            tone={admin ? "ok" : "err"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Probe a family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="probe-hh">Household</Label>
              <select
                id="probe-hh"
                className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                value={probe.householdId}
                onChange={(e) =>
                  setProbe({ householdId: e.target.value, familyId: "" })
                }
              >
                <option value="">— pick —</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.active ? "" : "(removed)"} ({h.id.slice(0, 6)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="probe-fam">Family</Label>
              <select
                id="probe-fam"
                className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                value={probe.familyId}
                onChange={(e) =>
                  setProbe((p) => ({ ...p, familyId: e.target.value }))
                }
              >
                <option value="">— pick —</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.active ? "" : "(removed)"} · members=
                    {f.memberCount}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={probeRead}>
              Read family doc
            </Button>
            <Button size="sm" variant="outline" onClick={probeSoftDelete}>
              Soft-delete (active=false)
            </Button>
            <Button size="sm" variant="outline" onClick={probeAddMember}>
              Add 2 members
            </Button>
            {!admin ? (
              <Button size="sm" onClick={probeBootstrapAdmin}>
                Bootstrap me as admin
              </Button>
            ) : null}
          </div>
          {probeResult ? (
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
              {probeResult}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
            {log.length === 0 ? (
              <p className="text-muted-foreground">No activity yet.</p>
            ) : (
              log.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{e.ts}</span>
                  <Badge
                    variant={
                      e.level === "ok"
                        ? "default"
                        : e.level === "err"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {e.level}
                  </Badge>
                  <span className="font-mono">{e.msg}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ k, v, tone }: { k: string; v: string; tone?: "ok" | "err" }) {
  return (
    <p>
      <span className="text-muted-foreground">{k}:</span>{" "}
      <span
        className={
          tone === "ok"
            ? "font-mono text-green-700 dark:text-green-400"
            : tone === "err"
              ? "font-mono text-destructive"
              : "font-mono"
        }
      >
        {v}
      </span>
    </p>
  );
}
