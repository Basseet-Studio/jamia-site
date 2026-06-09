"use client";
/** Live money-on-hand hook. */
import { useEffect, useState } from "react";
import { subscribeMoneyOnHand } from "@/lib/services/moneyOnHand";
import type { MoneyOnHand } from "@/lib/types";

export function useMoneyOnHand() {
  const [moh, setMoh] = useState<MoneyOnHand>({
    value: 0,
    currency: "",
    asOf: null as never,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeMoneyOnHand((m) => {
      setMoh(m);
      setLoading(false);
    });
    return off;
  }, []);

  return { moh, loading };
}
