"use client";
/**
 * Generic hook: subscribes to a Firestore collection and stores results in state.
 * Forwards query errors as a non-null error string.
 */
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  type Query,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";

export interface UseFirestoreCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

export function useFirestoreCollection<T extends { id: string }>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  mapFn?: (id: string, data: DocumentData) => T
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = query(collection(getDb(), path), ...constraints) as Query<DocumentData>;
    const off = onSnapshot(
      ref,
      (snap) => {
        const items = snap.docs.map((d) =>
          mapFn
            ? mapFn(d.id, d.data())
            : ({ id: d.id, ...(d.data() as object) } as T)
        );
        setData(items);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return off;
  }, [path, JSON.stringify(constraints)]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
