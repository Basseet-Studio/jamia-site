"use client";
/**
 * Per-family member change history. Members live on the family
 * (household -> family -> members), so history is per-family.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { subscribeMemberHistory } from "@/lib/services/memberHistory";
import { subscribeFamily } from "@/lib/services/families";
import { MemberHistoryTable } from "@/components/households/MemberHistoryTable";
import type { Family, FamilyMemberHistory } from "@/lib/types";

export default function FamilyMembersHistoryPage({
  params,
}: {
  params: Promise<{ householdId: string; familyId: string }>;
}) {
  const { householdId, familyId } = use(params);
  const t = useT();
  const [family, setFamily] = useState<Family | null>(null);
  const [history, setHistory] = useState<FamilyMemberHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeFamily(householdId, familyId, (f) => {
      setFamily(f);
    });
    return off;
  }, [householdId, familyId]);

  useEffect(() => {
    const off = subscribeMemberHistory(householdId, familyId, (rows) => {
      setHistory(rows);
      setLoading(false);
    });
    return off;
  }, [householdId, familyId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {family
            ? t("householdMembers.historyTitle", { name: family.name })
            : t("householdMembers.historyTitle", { name: "" })}
        </h1>
        <Link
          href={`/households/${householdId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("common.back")}
        </Link>
      </div>
      <MemberHistoryTable history={history} loading={loading} />
    </div>
  );
}
