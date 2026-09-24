import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  contributionSchema,
  type ContributionSchema,
} from "@/lib/schemas/contribution";
import {
  attachmentFieldsFromInput,
  deleteReceiptAttachment,
  parseAttachmentFields,
  uploadReceiptAttachment,
} from "@/lib/services/attachments";
import type { Contribution } from "@/lib/types";
import {
  getSettingsSnapInTx,
} from "@/lib/services/moneyOnHand";
import { nextReceiptNumbers } from "@/lib/services/receiptSerial";

function toContribution(id: string, data: Record<string, unknown>): Contribution {
  return {
    id,
    contributorName: String(data.contributorName ?? ""),
    amount: typeof data.amount === "number" ? data.amount : 0,
    date: data.date as Contribution["date"],
    note: (data.note as Contribution["note"]) ?? null,
    addedAt: data.addedAt as Contribution["addedAt"],
    addedBy: String(data.addedBy ?? ""),
    receiptNo:
      typeof data.receiptNo === "number" && data.receiptNo > 0
        ? Math.trunc(data.receiptNo)
        : null,
    ...parseAttachmentFields(data),
  };
}

export async function addContribution(
  uid: string,
  input: ContributionSchema,
  attachmentFile?: File | null,
): Promise<string> {
  const parsed = contributionSchema.parse(input);
  const db = getDb();
  const newRef = doc(collection(db, "contributions"));
  const attachment = attachmentFile
    ? await uploadReceiptAttachment("contributions", newRef.id, attachmentFile)
    : null;
  await runTransaction(db, async (tx) => {
    const { ref: settingsRef, data: settingsData } =
      await getSettingsSnapInTx(tx);
    const { numbers, field, nextSeq } = nextReceiptNumbers(
      settingsData,
      "contribution",
      1,
    );
    tx.update(settingsRef, {
      [field]: nextSeq,
      updatedAt: serverTimestamp(),
    });
    tx.set(newRef, {
      contributorName: parsed.contributorName,
      amount: parsed.amount,
      date: parsed.date,
      note: parsed.note,
      addedAt: serverTimestamp(),
      addedBy: uid,
      receiptNo: numbers[0],
      ...attachmentFieldsFromInput(attachment),
    });
  });
  return newRef.id;
}

export async function deleteContribution(contributionId: string): Promise<void> {
  const ref = doc(getDb(), "contributions", contributionId);
  const snap = await getDoc(ref);
  const attachmentPath =
    snap.exists() &&
    typeof snap.data().attachmentPath === "string"
      ? (snap.data().attachmentPath as string)
      : null;
  await deleteDoc(ref);
  if (attachmentPath) {
    try {
      await deleteReceiptAttachment(attachmentPath);
    } catch {
      // best-effort storage cleanup
    }
  }
}

export async function listContributions(): Promise<Contribution[]> {
  const snap = await getDocs(collection(getDb(), "contributions"));
  return snap.docs.map((d) =>
    toContribution(d.id, d.data() as Record<string, unknown>),
  );
}

export { toContribution };
