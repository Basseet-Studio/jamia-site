/**
 * Recurring expense templates service: `recurringExpenses`.
 *
 * Mosque-only: per product decision, household-type recurring templates are
 * not allowed. The schema forces `type: "mosque"` on create, and this
 * service forces mosque-only fields on write. `toTemplate` still reads
 * legacy rows defensively but normalises `type` to "mosque" if missing or
 * anything other than "mosque" (legacy household rows are surfaced as
 * mosque-shaped templates so existing data isn't orphaned).
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  createRecurringTemplateSchema,
  updateRecurringTemplateSchema,
  type CreateRecurringTemplateSchema,
  type UpdateRecurringTemplateSchema,
} from "@/lib/schemas/recurringTemplate";
import { toMonthKey } from "@/lib/utils/dates";
import type {
  MosqueSubCategory,
  RecurringTemplate,
  RecurringTemplateWithStatus,
} from "@/lib/types";

const MOSQUE_SUBS: readonly MosqueSubCategory[] = [
  "maintenance",
  "salary",
  "other",
];

function normaliseSubCategory(raw: unknown): MosqueSubCategory {
  return MOSQUE_SUBS.includes(raw as MosqueSubCategory)
    ? (raw as MosqueSubCategory)
    : "other";
}

function toTemplate(
  id: string,
  data: Record<string, unknown>,
): RecurringTemplate {
  return {
    id,
    name: String(data.name ?? ""),
    amount: typeof data.amount === "number" ? data.amount : 0,
    description: (data.description as RecurringTemplate["description"]) ?? null,
    active: data.active !== false,
    createdAt: data.createdAt as RecurringTemplate["createdAt"],
    createdBy: String(data.createdBy ?? ""),
    type: "mosque",
    householdId: null,
    familyId: null,
    mosqueSubCategory: normaliseSubCategory(data.mosqueSubCategory),
  };
}

export async function listRecurringTemplates(
  activeOnly: boolean,
): Promise<RecurringTemplate[]> {
  const ref = activeOnly
    ? query(
        collection(getDb(), "recurringExpenses"),
        where("active", "==", true),
      )
    : collection(getDb(), "recurringExpenses");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => toTemplate(d.id, d.data()));
}

export function subscribeRecurringTemplates(
  activeOnly: boolean,
  callback: (t: RecurringTemplate[]) => void,
): Unsubscribe {
  const ref = activeOnly
    ? query(
        collection(getDb(), "recurringExpenses"),
        where("active", "==", true),
      )
    : collection(getDb(), "recurringExpenses");
  return onSnapshot(ref, (snap) =>
    callback(snap.docs.map((d) => toTemplate(d.id, d.data()))),
  );
}

export async function createRecurringTemplate(
  uid: string,
  input: CreateRecurringTemplateSchema,
): Promise<string> {
  const parsed = createRecurringTemplateSchema.parse(input);
  const ref = await addDoc(collection(getDb(), "recurringExpenses"), {
    name: parsed.name,
    amount: parsed.amount,
    description: parsed.description,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: uid,
    type: "mosque",
    householdId: null,
    familyId: null,
    mosqueSubCategory: parsed.mosqueSubCategory,
  });
  return ref.id;
}

export async function updateRecurringTemplate(
  uid: string,
  templateId: string,
  input: UpdateRecurringTemplateSchema,
): Promise<void> {
  const parsed = updateRecurringTemplateSchema.parse(input);
  const ref = doc(getDb(), "recurringExpenses", templateId);
  await updateDoc(ref, {
    ...parsed,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function archiveRecurringTemplate(
  uid: string,
  templateId: string,
): Promise<void> {
  const ref = doc(getDb(), "recurringExpenses", templateId);
  await updateDoc(ref, {
    active: false,
    archivedAt: serverTimestamp(),
    archivedBy: uid,
  });
}

/**
 * Add a template for a specific month. Creates an expense with isRecurring=true,
 * recurringId=templateId, withdrawn=false. Copies the template's mosque
 * sub-category onto the new expense. Refuses if a matching expense already
 * exists for (templateId, month).
 */
export async function addRecurringForMonth(
  uid: string,
  templateId: string,
  month: string,
): Promise<string> {
  // Look up the template to capture name + amount + sub-category.
  const tplSnap = await getDocs(
    query(
      collection(getDb(), "recurringExpenses"),
      where("__name__", "==", templateId),
    ),
  );
  if (tplSnap.empty) {
    throw new Error(`recurring template ${templateId} not found`);
  }
  const tplData = tplSnap.docs[0].data();
  const tpl = toTemplate(tplSnap.docs[0].id, tplData);
  const name = tpl.name;
  const amount = tpl.amount;

  // Idempotency check: refuse if a recurring expense for this template+month exists.
  const dupSnap = await getDocs(
    query(
      collection(getDb(), "expenses"),
      where("recurringId", "==", templateId),
      where("month", "==", month),
    ),
  );
  if (!dupSnap.empty) {
    throw new Error(
      `Recurring template already added for ${month} (expense ${dupSnap.docs[0].id})`,
    );
  }

  // Use a date in the middle of the month for the expense date.
  const date = new Date(`${month}-15T00:00:00`);
  const ref = await addDoc(collection(getDb(), "expenses"), {
    name,
    amount,
    date,
    month,
    note: null,
    isRecurring: true,
    recurringId: templateId,
    withdrawn: false,
    withdrawnAt: null,
    withdrawnBy: null,
    addedAt: serverTimestamp(),
    addedBy: uid,
    type: "mosque",
    householdId: null,
    familyId: null,
    mosqueSubCategory: tpl.mosqueSubCategory,
  });
  void toMonthKey;
  return ref.id;
}

export async function listRecurringTemplatesWithStatus(
  month: string,
): Promise<RecurringTemplateWithStatus[]> {
  const templates = await listRecurringTemplates(false);
  if (templates.length === 0) return [];
  // Fetch one snapshot of expenses for this month; group by recurringId.
  const exSnap = await getDocs(
    query(collection(getDb(), "expenses"), where("month", "==", month)),
  );
  const byTpl = new Map<string, { id: string; withdrawn: boolean }>();
  exSnap.docs.forEach((d) => {
    const data = d.data();
    const rid = data.recurringId as string | null;
    if (!rid) return;
    if (!byTpl.has(rid)) {
      byTpl.set(rid, { id: d.id, withdrawn: data.withdrawn === true });
    }
  });

  return templates.map((t) => {
    const hit = byTpl.get(t.id);
    if (!hit) {
      return {
        ...t,
        currentMonthStatus: "NotAdded",
        currentMonthExpenseId: null,
      };
    }
    return {
      ...t,
      currentMonthStatus: hit.withdrawn ? "Withdrawn" : "PendingWithdrawal",
      currentMonthExpenseId: hit.id,
    };
  });
}
