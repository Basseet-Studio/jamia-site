/**
 * Dump DB service (web).
 *
 * No new npm packages — uses existing zod@^4 / firebase@^12 plus current
 * list* helpers and `/api/receipts/download`. UI never calls Firebase;
 * only this module (and existing receipt helpers) may.
 *
 * Contract: jamia-native/specs/005-desktop-offline-port/contracts/dump-service.ts
 */
import {
  Timestamp,
  doc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  LEGACY_ADMINS_COLLECTION,
  STAFF_COLLECTION,
} from "@/lib/auth/collections";
import {
  DUMP_MAX_ATTACHMENTS,
  DUMP_MAX_BYTES,
  DUMP_OVER_CEILING_MESSAGE,
} from "@/lib/schemas/dumpLimits";
import {
  parseJamiaDump,
  DumpValidationError,
  type JamiaDumpV1,
} from "@/lib/schemas/jamiaDump";
import { listAdmins, listLegacyAdmins } from "@/lib/services/admins";
import {
  getAttachmentDownloadUrl,
  uploadReceiptAttachment,
} from "@/lib/services/attachments";
import { listContributions } from "@/lib/services/contributions";
import { listExpenses } from "@/lib/services/expenses";
import { listFamilies, listMemberHistory } from "@/lib/services/families";
import { listAllHouseholds } from "@/lib/services/households";
import { listPayments } from "@/lib/services/payments";
import { listRecurringTemplates } from "@/lib/services/recurring";
import { getSettingsDump } from "@/lib/services/settings";
import type {
  Admin,
  Contribution,
  Expense,
  Family,
  FamilyMemberHistory,
  Household,
  Payment,
  RecurringTemplate,
} from "@/lib/types";

export const DUMP_FORMAT = "jamia-dump" as const;
export const DUMP_SCHEMA_VERSION = 1 as const;

export { DumpValidationError };

export class DumpExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DumpExportError";
  }
}

export interface DumpExportResult {
  fileName: string;
  byteSize: number;
  recordCounts: Record<string, number>;
}

function dumpFileName(now: Date): string {
  return `jamia-dump-v1-${now.toISOString().slice(0, 10)}.json`;
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  return null;
}

function toIsoRequired(value: unknown, field: string): string {
  const iso = toIso(value);
  if (!iso) {
    throw new DumpExportError(`Dump export missing timestamp: ${field}`);
  }
  return iso;
}

function staffRow(admin: Admin) {
  return {
    id: admin.uid,
    email: admin.email,
    displayName: admin.displayName,
    role: admin.role,
    addedAt: toIsoRequired(admin.addedAt, `staff.${admin.uid}.addedAt`),
  };
}

function householdRow(h: Household) {
  return {
    id: h.id,
    name: h.name,
    createdAt: toIsoRequired(h.createdAt, `households.${h.id}.createdAt`),
    createdBy: h.createdBy,
    active: h.active,
    deletedAt: toIso(h.deletedAt),
    deletedBy: h.deletedBy,
  };
}

function familyRow(f: Family) {
  return {
    id: f.id,
    householdId: f.householdId,
    name: f.name,
    contributionTarget: f.contributionTarget,
    createdAt: toIsoRequired(f.createdAt, `families.${f.id}.createdAt`),
    createdBy: f.createdBy,
    active: f.active,
    deletedAt: toIso(f.deletedAt),
    deletedBy: f.deletedBy,
    memberCount: f.memberCount,
    memberNames: f.memberNames,
    updatedAt: toIso(f.updatedAt),
    updatedBy: f.updatedBy,
  };
}

function historyRow(h: FamilyMemberHistory) {
  return {
    id: h.id,
    householdId: h.householdId,
    familyId: h.familyId,
    previousCount: h.previousCount,
    previousNames: h.previousNames,
    newCount: h.newCount,
    newNames: h.newNames,
    changedAt: toIsoRequired(h.changedAt, `memberHistory.${h.id}.changedAt`),
    changedBy: h.changedBy,
  };
}

function paymentRow(p: Payment) {
  return {
    id: p.id,
    householdId: p.householdId,
    familyId: p.familyId,
    amount: p.amount,
    date: toIsoRequired(p.date, `payments.${p.id}.date`),
    month: p.month,
    note: p.note,
    recordedAt: toIsoRequired(p.recordedAt, `payments.${p.id}.recordedAt`),
    recordedBy: p.recordedBy,
    coverageGroupId: p.coverageGroupId,
    attachmentPath: p.attachmentPath ?? null,
    attachmentFileName: p.attachmentFileName ?? null,
    attachmentMimeType: p.attachmentMimeType ?? null,
  };
}

function contributionRow(c: Contribution) {
  return {
    id: c.id,
    contributorName: c.contributorName,
    amount: c.amount,
    date: toIsoRequired(c.date, `contributions.${c.id}.date`),
    note: c.note,
    addedAt: toIsoRequired(c.addedAt, `contributions.${c.id}.addedAt`),
    addedBy: c.addedBy,
    attachmentPath: c.attachmentPath ?? null,
    attachmentFileName: c.attachmentFileName ?? null,
    attachmentMimeType: c.attachmentMimeType ?? null,
  };
}

function expenseRow(e: Expense) {
  const mosque = e.type === "mosque";
  return {
    id: e.id,
    name: e.name,
    amount: e.amount,
    date: toIsoRequired(e.date, `expenses.${e.id}.date`),
    month: e.month,
    note: e.note,
    isRecurring: e.isRecurring,
    recurringId: e.recurringId,
    withdrawn: e.withdrawn,
    withdrawnAt: toIso(e.withdrawnAt),
    withdrawnBy: e.withdrawnBy,
    addedAt: toIsoRequired(e.addedAt, `expenses.${e.id}.addedAt`),
    addedBy: e.addedBy,
    type: e.type,
    householdId: mosque ? null : e.householdId,
    familyId: mosque ? null : e.familyId,
    mosqueSubCategory: mosque ? e.mosqueSubCategory : null,
    attachmentPath: e.attachmentPath ?? null,
    attachmentFileName: e.attachmentFileName ?? null,
    attachmentMimeType: e.attachmentMimeType ?? null,
  };
}

function templateRow(t: RecurringTemplate) {
  return {
    id: t.id,
    name: t.name,
    amount: t.amount,
    description: t.description,
    active: t.active,
    createdAt: toIsoRequired(t.createdAt, `recurringTemplates.${t.id}.createdAt`),
    createdBy: t.createdBy,
    type: t.type,
    householdId: t.householdId,
    familyId: t.familyId,
    mosqueSubCategory: t.mosqueSubCategory,
    updatedAt: toIso(t.updatedAt ?? null),
    updatedBy: t.updatedBy ?? null,
    archivedAt: toIso(t.archivedAt ?? null),
    archivedBy: t.archivedBy ?? null,
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readAttachmentBytes(path: string): Promise<string> {
  let url: string;
  try {
    url = await getAttachmentDownloadUrl(path);
  } catch {
    throw new DumpExportError(`Cannot read attachment ${path}`);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new DumpExportError(`Cannot read attachment ${path}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new DumpExportError(`Cannot read attachment ${path}`);
  }
  return uint8ToBase64(buf);
}

type AttachmentMeta = {
  id: string;
  entityType: "payments" | "contributions" | "expenses";
  fileName: string;
  mimeType: string;
  path: string;
};

function collectAttachmentMetas(
  payments: Payment[],
  contributions: Contribution[],
  expenses: Expense[],
): AttachmentMeta[] {
  const out: AttachmentMeta[] = [];
  const push = (
    id: string,
    entityType: AttachmentMeta["entityType"],
    path: string | null | undefined,
    fileName: string | null | undefined,
    mimeType: string | null | undefined,
  ) => {
    if (!path) return;
    const name =
      fileName && fileName.length > 0
        ? fileName
        : path.split("/").pop() || "file";
    out.push({
      id,
      entityType,
      fileName: name,
      mimeType:
        mimeType && mimeType.length > 0
          ? mimeType
          : "application/octet-stream",
      path,
    });
  };
  for (const p of payments) {
    push(
      p.id,
      "payments",
      p.attachmentPath,
      p.attachmentFileName,
      p.attachmentMimeType,
    );
  }
  for (const c of contributions) {
    push(
      c.id,
      "contributions",
      c.attachmentPath,
      c.attachmentFileName,
      c.attachmentMimeType,
    );
  }
  for (const e of expenses) {
    push(
      e.id,
      "expenses",
      e.attachmentPath,
      e.attachmentFileName,
      e.attachmentMimeType,
    );
  }
  return out;
}

function triggerJsonDownload(json: string, fileName: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildDump(now = new Date()): Promise<JamiaDumpV1> {
  const [
    settings,
    staff,
    legacyAdmins,
    households,
    expenses,
    templates,
    contributions,
  ] = await Promise.all([
    getSettingsDump(),
    listAdmins(),
    listLegacyAdmins(),
    listAllHouseholds(),
    listExpenses("all"),
    listRecurringTemplates(false),
    listContributions(),
  ]);
  if (!settings) {
    throw new DumpExportError("settings/global missing");
  }

  const familiesByHousehold = await Promise.all(
    households.map((h) => listFamilies(h.id)),
  );
  const families = familiesByHousehold.flat();

  const paymentsByFamily = await Promise.all(
    families.map((f) => listPayments(f.householdId, f.id)),
  );
  const payments = paymentsByFamily.flat();

  const historyByFamily = await Promise.all(
    families.map((f) => listMemberHistory(f.householdId, f.id)),
  );
  const memberHistory = historyByFamily.flat();

  const metas = collectAttachmentMetas(payments, contributions, expenses);
  if (metas.length > DUMP_MAX_ATTACHMENTS) {
    throw new DumpExportError(DUMP_OVER_CEILING_MESSAGE);
  }
  const attachments = [];
  for (const meta of metas) {
    const dataBase64 = await readAttachmentBytes(meta.path);
    attachments.push({ ...meta, dataBase64 });
  }

  const dump = {
    format: DUMP_FORMAT,
    schemaVersion: DUMP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: "web" as const,
    settings: {
      defaultContributionTarget: settings.defaultContributionTarget,
      openingBalance: settings.openingBalance,
      currency: settings.currency,
      moneyOnHand: settings.moneyOnHand,
      updatedAt: toIso(settings.updatedAt),
      updatedBy: settings.updatedBy,
    },
    staff: staff.map(staffRow),
    admins: legacyAdmins.map(staffRow),
    households: households.map(householdRow),
    families: families.map(familyRow),
    memberHistory: memberHistory.map(historyRow),
    payments: payments.map(paymentRow),
    contributions: contributions.map(contributionRow),
    expenses: expenses.map(expenseRow),
    recurringTemplates: templates.map(templateRow),
    attachments,
  };

  return parseJamiaDump(dump, { requireStaff: false });
}

/** Build + download. Fail if any attachment file cannot be read. */
export async function exportDump(now = new Date()): Promise<DumpExportResult> {
  const dump = await buildDump(now);
  const json = JSON.stringify(dump);
  const byteSize = new TextEncoder().encode(json).byteLength;
  if (byteSize > DUMP_MAX_BYTES) {
    throw new DumpExportError(DUMP_OVER_CEILING_MESSAGE);
  }
  const fileName = dumpFileName(now);
  triggerJsonDownload(json, fileName);
  return {
    fileName,
    byteSize,
    recordCounts: {
      staff: dump.staff.length,
      admins: dump.admins.length,
      households: dump.households.length,
      families: dump.families.length,
      memberHistory: dump.memberHistory.length,
      payments: dump.payments.length,
      contributions: dump.contributions.length,
      expenses: dump.expenses.length,
      recurringTemplates: dump.recurringTemplates.length,
      attachments: dump.attachments.length,
    },
  };
}

export const WRITE_BATCH_LIMIT = 500;

export const PARTIAL_IMPORT_MESSAGE_TEMPLATE =
  "The import did not finish. Your data may be a mix of old and new. Re-import the backup file that was downloaded before this started ({backupFileName}) to restore your previous data.";

export interface DumpImportResult {
  recordCounts: Record<string, number>;
  backupFileName: string | null;
}

export interface PartialImportFailure {
  backupFileName: string;
  message: string;
}

export class PartialImportFailureError
  extends Error
  implements PartialImportFailure
{
  readonly backupFileName: string;
  constructor(backupFileName: string) {
    const message = PARTIAL_IMPORT_MESSAGE_TEMPLATE.replace(
      "{backupFileName}",
      backupFileName,
    );
    super(message);
    this.name = "PartialImportFailureError";
    this.backupFileName = backupFileName;
  }
}

export function validateDump(raw: unknown): JamiaDumpV1 {
  return parseJamiaDump(raw, { requireStaff: true });
}

export type ImportOpPhase = "financial" | "staff";

export type ImportOp = {
  phase: ImportOpPhase;
  kind: "set" | "delete";
  collection: string;
  path: string[];
  data?: Record<string, unknown>;
};

function ts(iso: string | null | undefined): Timestamp | null {
  if (!iso) return null;
  return Timestamp.fromDate(new Date(iso));
}

function tsRequired(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso));
}

function dumpCounts(dump: JamiaDumpV1): Record<string, number> {
  return {
    staff: dump.staff.length,
    admins: dump.admins.length,
    households: dump.households.length,
    families: dump.families.length,
    memberHistory: dump.memberHistory.length,
    payments: dump.payments.length,
    contributions: dump.contributions.length,
    expenses: dump.expenses.length,
    recurringTemplates: dump.recurringTemplates.length,
    attachments: dump.attachments.length,
  };
}

/** Financial setDocs first (settings → tree → money rows), then staff/admins. */
export function planDumpSetOps(dump: JamiaDumpV1): ImportOp[] {
  const financial: ImportOp[] = [];
  financial.push({
    phase: "financial",
    kind: "set",
    collection: "settings",
    path: ["settings", "global"],
    data: {
      defaultContributionTarget: dump.settings.defaultContributionTarget,
      openingBalance: dump.settings.openingBalance,
      currency: dump.settings.currency,
      moneyOnHand: dump.settings.moneyOnHand,
      updatedAt: ts(dump.settings.updatedAt),
      updatedBy: dump.settings.updatedBy,
    },
  });
  for (const h of dump.households) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "households",
      path: ["households", h.id],
      data: {
        name: h.name,
        createdAt: tsRequired(h.createdAt),
        createdBy: h.createdBy,
        active: h.active,
        deletedAt: ts(h.deletedAt),
        deletedBy: h.deletedBy,
      },
    });
  }
  for (const f of dump.families) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "families",
      path: ["households", f.householdId, "families", f.id],
      data: {
        name: f.name,
        contributionTarget: f.contributionTarget,
        createdAt: tsRequired(f.createdAt),
        createdBy: f.createdBy,
        active: f.active,
        deletedAt: ts(f.deletedAt),
        deletedBy: f.deletedBy,
        memberCount: f.memberCount,
        memberNames: f.memberNames,
        updatedAt: ts(f.updatedAt),
        updatedBy: f.updatedBy,
      },
    });
  }
  for (const t of dump.recurringTemplates) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "recurringExpenses",
      path: ["recurringExpenses", t.id],
      data: {
        name: t.name,
        amount: t.amount,
        description: t.description,
        active: t.active,
        createdAt: tsRequired(t.createdAt),
        createdBy: t.createdBy,
        type: t.type,
        householdId: t.householdId,
        familyId: t.familyId,
        mosqueSubCategory: t.mosqueSubCategory,
        updatedAt: ts(t.updatedAt),
        updatedBy: t.updatedBy,
        archivedAt: ts(t.archivedAt),
        archivedBy: t.archivedBy,
      },
    });
  }
  for (const h of dump.memberHistory) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "memberHistory",
      path: [
        "households",
        h.householdId,
        "families",
        h.familyId,
        "memberHistory",
        h.id,
      ],
      data: {
        householdId: h.householdId,
        familyId: h.familyId,
        previousCount: h.previousCount,
        previousNames: h.previousNames,
        newCount: h.newCount,
        newNames: h.newNames,
        changedAt: tsRequired(h.changedAt),
        changedBy: h.changedBy,
      },
    });
  }
  for (const p of dump.payments) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "payments",
      path: [
        "households",
        p.householdId,
        "families",
        p.familyId,
        "payments",
        p.id,
      ],
      data: {
        amount: p.amount,
        date: tsRequired(p.date),
        month: p.month,
        note: p.note,
        recordedAt: tsRequired(p.recordedAt),
        recordedBy: p.recordedBy,
        coverageGroupId: p.coverageGroupId,
        attachmentPath: p.attachmentPath,
        attachmentFileName: p.attachmentFileName,
        attachmentMimeType: p.attachmentMimeType,
      },
    });
  }
  for (const c of dump.contributions) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "contributions",
      path: ["contributions", c.id],
      data: {
        contributorName: c.contributorName,
        amount: c.amount,
        date: tsRequired(c.date),
        note: c.note,
        addedAt: tsRequired(c.addedAt),
        addedBy: c.addedBy,
        attachmentPath: c.attachmentPath,
        attachmentFileName: c.attachmentFileName,
        attachmentMimeType: c.attachmentMimeType,
      },
    });
  }
  for (const e of dump.expenses) {
    financial.push({
      phase: "financial",
      kind: "set",
      collection: "expenses",
      path: ["expenses", e.id],
      data: {
        name: e.name,
        amount: e.amount,
        date: tsRequired(e.date),
        month: e.month,
        note: e.note,
        isRecurring: e.isRecurring,
        recurringId: e.recurringId,
        withdrawn: e.withdrawn,
        withdrawnAt: ts(e.withdrawnAt),
        withdrawnBy: e.withdrawnBy,
        addedAt: tsRequired(e.addedAt),
        addedBy: e.addedBy,
        type: e.type,
        householdId: e.householdId,
        familyId: e.familyId,
        mosqueSubCategory: e.mosqueSubCategory,
        attachmentPath: e.attachmentPath,
        attachmentFileName: e.attachmentFileName,
        attachmentMimeType: e.attachmentMimeType,
      },
    });
  }

  const staff: ImportOp[] = [];
  for (const s of dump.staff) {
    staff.push({
      phase: "staff",
      kind: "set",
      collection: STAFF_COLLECTION,
      path: [STAFF_COLLECTION, s.id],
      data: {
        email: s.email,
        displayName: s.displayName,
        role: s.role,
        addedAt: tsRequired(s.addedAt),
      },
    });
  }
  for (const a of dump.admins) {
    staff.push({
      phase: "staff",
      kind: "set",
      collection: LEGACY_ADMINS_COLLECTION,
      path: [LEGACY_ADMINS_COLLECTION, a.id],
      data: {
        email: a.email,
        displayName: a.displayName,
        role: a.role,
        addedAt: tsRequired(a.addedAt),
      },
    });
  }
  return [...financial, ...staff];
}

export function planExtraDeletes(
  dump: JamiaDumpV1,
  existing: {
    households: { id: string }[];
    families: { id: string; householdId: string }[];
    memberHistory: { id: string; householdId: string; familyId: string }[];
    payments: { id: string; householdId: string; familyId: string }[];
    contributions: { id: string }[];
    expenses: { id: string }[];
    templates: { id: string }[];
    staff: { uid: string }[];
    admins: { uid: string }[];
  },
): ImportOp[] {
  const hh = new Set(dump.households.map((h) => h.id));
  const fam = new Set(dump.families.map((f) => f.id));
  const hist = new Set(dump.memberHistory.map((h) => h.id));
  const pay = new Set(dump.payments.map((p) => p.id));
  const contrib = new Set(dump.contributions.map((c) => c.id));
  const exp = new Set(dump.expenses.map((e) => e.id));
  const tmpl = new Set(dump.recurringTemplates.map((t) => t.id));
  const staffIds = new Set(dump.staff.map((s) => s.id));
  const adminIds = new Set(dump.admins.map((a) => a.id));

  const financial: ImportOp[] = [];
  for (const p of existing.payments) {
    if (pay.has(p.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "payments",
      path: [
        "households",
        p.householdId,
        "families",
        p.familyId,
        "payments",
        p.id,
      ],
    });
  }
  for (const h of existing.memberHistory) {
    if (hist.has(h.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "memberHistory",
      path: [
        "households",
        h.householdId,
        "families",
        h.familyId,
        "memberHistory",
        h.id,
      ],
    });
  }
  for (const f of existing.families) {
    if (fam.has(f.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "families",
      path: ["households", f.householdId, "families", f.id],
    });
  }
  for (const h of existing.households) {
    if (hh.has(h.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "households",
      path: ["households", h.id],
    });
  }
  for (const c of existing.contributions) {
    if (contrib.has(c.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "contributions",
      path: ["contributions", c.id],
    });
  }
  for (const e of existing.expenses) {
    if (exp.has(e.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "expenses",
      path: ["expenses", e.id],
    });
  }
  for (const t of existing.templates) {
    if (tmpl.has(t.id)) continue;
    financial.push({
      phase: "financial",
      kind: "delete",
      collection: "recurringExpenses",
      path: ["recurringExpenses", t.id],
    });
  }

  const staff: ImportOp[] = [];
  for (const s of existing.staff) {
    if (staffIds.has(s.uid)) continue;
    staff.push({
      phase: "staff",
      kind: "delete",
      collection: STAFF_COLLECTION,
      path: [STAFF_COLLECTION, s.uid],
    });
  }
  for (const a of existing.admins) {
    if (adminIds.has(a.uid)) continue;
    staff.push({
      phase: "staff",
      kind: "delete",
      collection: LEGACY_ADMINS_COLLECTION,
      path: [LEGACY_ADMINS_COLLECTION, a.uid],
    });
  }
  return [...financial, ...staff];
}

export function scheduledImportOps(
  dump: JamiaDumpV1,
  existing: Parameters<typeof planExtraDeletes>[1],
): ImportOp[] {
  const sets = planDumpSetOps(dump);
  const deletes = planExtraDeletes(dump, existing);
  const financial = [
    ...sets.filter((o) => o.phase === "financial"),
    ...deletes.filter((o) => o.phase === "financial"),
  ];
  const staff = [
    ...sets.filter((o) => o.phase === "staff"),
    ...deletes.filter((o) => o.phase === "staff"),
  ];
  return [...financial, ...staff];
}

async function commitOps(ops: ImportOp[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < ops.length; i += WRITE_BATCH_LIMIT) {
    const chunk = ops.slice(i, i + WRITE_BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, op.path[0]!, ...op.path.slice(1));
      if (op.kind === "set") {
        batch.set(ref, op.data ?? {});
      } else {
        batch.delete(ref);
      }
    }
    await batch.commit();
  }
}

function base64ToFile(b64: string, fileName: string, mimeType: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mimeType });
}

async function listExistingForDelete(): Promise<
  Parameters<typeof planExtraDeletes>[1]
> {
  const [households, expenses, templates, contributions, staff, admins] =
    await Promise.all([
      listAllHouseholds(),
      listExpenses("all"),
      listRecurringTemplates(false),
      listContributions(),
      listAdmins(),
      listLegacyAdmins(),
    ]);
  const families = (
    await Promise.all(households.map((h) => listFamilies(h.id)))
  ).flat();
  const payments = (
    await Promise.all(families.map((f) => listPayments(f.householdId, f.id)))
  ).flat();
  const memberHistory = (
    await Promise.all(
      families.map((f) => listMemberHistory(f.householdId, f.id)),
    )
  ).flat();
  return {
    households,
    families,
    memberHistory,
    payments,
    contributions,
    expenses,
    templates,
    staff,
    admins,
  };
}

/**
 * Backup download, then chunked financial setDoc (≤500), then Storage
 * attachments, then staff/admins last. Never addDoc.
 */
export async function importDump(raw: unknown): Promise<DumpImportResult> {
  const dump = validateDump(raw);
  const backup = await exportDump();
  try {
    const existing = await listExistingForDelete();
    const ops = scheduledImportOps(dump, existing);
    const financial = ops.filter((o) => o.phase === "financial");
    const staff = ops.filter((o) => o.phase === "staff");
    await commitOps(financial);
    for (const att of dump.attachments) {
      const file = base64ToFile(att.dataBase64, att.fileName, att.mimeType);
      await uploadReceiptAttachment(att.entityType, att.id, file);
    }
    await commitOps(staff);
  } catch (e) {
    if (e instanceof PartialImportFailureError) throw e;
    throw new PartialImportFailureError(backup.fileName);
  }
  return {
    recordCounts: dumpCounts(dump),
    backupFileName: backup.fileName,
  };
}

