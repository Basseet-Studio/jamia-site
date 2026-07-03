"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { Contribution } from "@/lib/types";
import { parseAttachmentFields } from "@/lib/services/attachments";

function toContribution(
  id: string,
  data: Record<string, unknown>,
): Contribution {
  return {
    id,
    contributorName: String(data.contributorName ?? ""),
    amount: typeof data.amount === "number" ? data.amount : 0,
    date: data.date as Contribution["date"],
    note: (data.note as Contribution["note"]) ?? null,
    addedAt: data.addedAt as Contribution["addedAt"],
    addedBy: String(data.addedBy ?? ""),
    ...parseAttachmentFields(data),
  };
}

export function useContributions(): {
  contributions: Contribution[];
  loading: boolean;
  error: string | null;
} {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = query(
      collection(getDb(), "contributions"),
      orderBy("date", "desc"),
    );
    return onSnapshot(
      ref,
      (snap) => {
        setContributions(
          snap.docs.map((d) =>
            toContribution(d.id, d.data() as Record<string, unknown>),
          ),
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  return { contributions, loading, error };
}
