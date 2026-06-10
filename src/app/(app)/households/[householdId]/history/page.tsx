"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { subscribeMemberHistory } from "@/lib/services/memberHistory";
import { MemberHistoryTable } from "@/components/households/MemberHistoryTable";
import type { HouseholdMemberHistory } from "@/lib/types";

export default function HouseholdHistoryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = use(params);
  const t = useT();
  const [history, setHistory] = useState<HouseholdMemberHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeMemberHistory(householdId, (rows) => {
      setHistory(rows);
      setLoading(false);
    });
    return off;
  }, [householdId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t("householdDetail.historyHeading")}
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
