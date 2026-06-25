import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  contributionSchema,
  type ContributionSchema,
} from "@/lib/schemas/contribution";

export async function addContribution(
  uid: string,
  input: ContributionSchema,
): Promise<string> {
  const parsed = contributionSchema.parse(input);
  const ref = await addDoc(collection(getDb(), "contributions"), {
    contributorName: parsed.contributorName,
    amount: parsed.amount,
    date: parsed.date,
    note: parsed.note,
    addedAt: serverTimestamp(),
    addedBy: uid,
  });
  return ref.id;
}

export async function deleteContribution(contributionId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "contributions", contributionId));
}
