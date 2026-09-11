/**
 * jamia-dump v1 Zod schema + stream parse entry.
 * Ceiling constants: ./dumpLimits.ts
 * Contract: jamia-native/specs/005-desktop-offline-port/contracts/jamia-dump-v1.schema.json
 */
import { z } from "zod";
import {
  DUMP_MAX_ATTACHMENTS,
  DUMP_MAX_BYTES,
  DUMP_OVER_CEILING_MESSAGE,
} from "@/lib/schemas/dumpLimits";

export class DumpValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = "DumpValidationError";
  }
}

const iso = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    "iso-datetime",
  );
const isoNull = z.union([iso, z.null()]);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const role = z.enum(["owner", "admin", "clerk"]);

const staffRow = z
  .object({
    id: z.string().min(1),
    email: z.string(),
    displayName: z.string(),
    role,
    addedAt: iso,
  })
  .strict();

const settings = z
  .object({
    defaultContributionTarget: z.number().int().min(0),
    openingBalance: z.number(),
    currency: z.string().min(1).max(8),
    moneyOnHand: z.number(),
    updatedAt: isoNull,
    updatedBy: z.union([z.string(), z.null()]),
  })
  .strict();

const household = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    createdAt: iso,
    createdBy: z.string(),
    active: z.boolean(),
    deletedAt: isoNull,
    deletedBy: z.union([z.string(), z.null()]),
  })
  .strict();

const family = z
  .object({
    id: z.string().min(1),
    householdId: z.string().min(1),
    name: z.string().min(1).max(80),
    contributionTarget: z.number().int().min(0),
    createdAt: iso,
    createdBy: z.string(),
    active: z.boolean(),
    deletedAt: isoNull,
    deletedBy: z.union([z.string(), z.null()]),
    memberCount: z.number().int().min(0),
    memberNames: z.array(z.string().min(1).max(80)).max(200),
    updatedAt: isoNull,
    updatedBy: z.union([z.string(), z.null()]),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.memberCount !== f.memberNames.length) {
      ctx.addIssue({
        code: "custom",
        message: "memberCount must equal memberNames.length",
        path: ["memberCount"],
      });
    }
  });

const memberHistory = z
  .object({
    id: z.string(),
    householdId: z.string(),
    familyId: z.string(),
    previousCount: z.number().int().min(0),
    previousNames: z.array(z.string()),
    newCount: z.number().int().min(0),
    newNames: z.array(z.string()),
    changedAt: iso,
    changedBy: z.string(),
  })
  .strict();

const attachmentMeta = {
  attachmentPath: z.union([z.string(), z.null()]),
  attachmentFileName: z.union([z.string(), z.null()]),
  attachmentMimeType: z.union([z.string(), z.null()]),
};

const payment = z
  .object({
    id: z.string(),
    householdId: z.string(),
    familyId: z.string(),
    amount: z.number().gt(0),
    date: iso,
    month,
    note: z.union([z.string().max(280), z.null()]),
    recordedAt: iso,
    recordedBy: z.string(),
    coverageGroupId: z.union([z.string(), z.null()]),
    ...attachmentMeta,
  })
  .strict();

const contribution = z
  .object({
    id: z.string(),
    contributorName: z.string().min(1),
    amount: z.number().gt(0),
    date: iso,
    note: z.union([z.string().max(280), z.null()]),
    addedAt: iso,
    addedBy: z.string(),
    ...attachmentMeta,
  })
  .strict();

const expense = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(80),
    amount: z.number().gt(0),
    date: iso,
    month,
    note: z.union([z.string().max(280), z.null()]),
    isRecurring: z.boolean(),
    recurringId: z.union([z.string(), z.null()]),
    withdrawn: z.boolean(),
    withdrawnAt: isoNull,
    withdrawnBy: z.union([z.string(), z.null()]),
    addedAt: iso,
    addedBy: z.string(),
    type: z.enum(["household", "mosque"]),
    householdId: z.union([z.string(), z.null()]),
    familyId: z.union([z.string(), z.null()]),
    mosqueSubCategory: z.union([
      z.enum(["maintenance", "salary", "other"]),
      z.null(),
    ]),
    ...attachmentMeta,
  })
  .strict();

const recurringTemplate = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(80),
    amount: z.number().gt(0),
    description: z.union([z.string().max(280), z.null()]),
    active: z.boolean(),
    createdAt: iso,
    createdBy: z.string(),
    type: z.enum(["household", "mosque"]),
    householdId: z.union([z.string(), z.null()]),
    familyId: z.union([z.string(), z.null()]),
    mosqueSubCategory: z.union([
      z.enum(["maintenance", "salary", "other"]),
      z.null(),
    ]),
    updatedAt: isoNull,
    updatedBy: z.union([z.string(), z.null()]),
    archivedAt: isoNull,
    archivedBy: z.union([z.string(), z.null()]),
  })
  .strict();

const attachment = z
  .object({
    id: z.string().min(1),
    entityType: z.enum(["payments", "contributions", "expenses"]),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    path: z
      .string()
      .regex(/^receipts\/(payments|contributions|expenses)\/[^/]+\/[^/]+$/),
    dataBase64: z.string().min(1),
  })
  .strict();

export const jamiaDumpV1Schema = z
  .object({
    format: z.literal("jamia-dump"),
    schemaVersion: z.literal(1),
    exportedAt: iso,
    source: z.enum(["web", "desktop"]),
    settings,
    staff: z.array(staffRow),
    admins: z.array(staffRow),
    households: z.array(household),
    families: z.array(family),
    memberHistory: z.array(memberHistory),
    payments: z.array(payment),
    contributions: z.array(contribution),
    expenses: z.array(expense),
    recurringTemplates: z.array(recurringTemplate),
    attachments: z.array(attachment),
  })
  .strict();

export type JamiaDumpV1 = z.infer<typeof jamiaDumpV1Schema>;

export type ParseDumpOptions = {
  /** Web import rejects empty staff[]. Desktop round-trip may be empty. */
  requireStaff?: boolean;
};

function crossValidate(dump: JamiaDumpV1, issues: string[], requireStaff: boolean) {
  if (requireStaff && dump.staff.length === 0) issues.push("empty-staff");
  const hhIds = new Set(dump.households.map((h) => h.id));
  const famById = new Map(dump.families.map((f) => [f.id, f]));
  for (const f of dump.families) {
    if (!hhIds.has(f.householdId)) issues.push(`family-parent:${f.id}`);
  }
  for (const p of dump.payments) {
    const fam = famById.get(p.familyId);
    if (!fam) issues.push(`payment-family:${p.id}`);
    else if (fam.householdId !== p.householdId) {
      issues.push(`payment-household:${p.id}`);
    }
  }
  for (const h of dump.memberHistory) {
    if (!famById.has(h.familyId)) issues.push(`history-family:${h.id}`);
  }
  for (const e of dump.expenses) {
    if (e.type === "mosque") {
      if (e.householdId !== null || e.familyId !== null) {
        issues.push(`expense-mosque-xor:${e.id}`);
      }
    } else if (!e.householdId || !hhIds.has(e.householdId)) {
      issues.push(`expense-household:${e.id}`);
    }
  }
  const attKeys = new Set(
    dump.attachments.map((a) => `${a.entityType}:${a.id}`),
  );
  const check = (path: string | null, entity: string, id: string) => {
    if (!path) return;
    if (!attKeys.has(`${entity}:${id}`)) {
      issues.push(`missing-attachment:${entity}:${id}`);
    }
  };
  for (const p of dump.payments) check(p.attachmentPath, "payments", p.id);
  for (const c of dump.contributions) {
    check(c.attachmentPath, "contributions", c.id);
  }
  for (const e of dump.expenses) check(e.attachmentPath, "expenses", e.id);
}

export function parseJamiaDump(
  raw: unknown,
  opts: ParseDumpOptions = {},
): JamiaDumpV1 {
  const requireStaff = opts.requireStaff ?? true;
  const parsed = jamiaDumpV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new DumpValidationError(
      "Dump validation failed",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  if (parsed.data.attachments.length > DUMP_MAX_ATTACHMENTS) {
    throw new DumpValidationError(DUMP_OVER_CEILING_MESSAGE, [
      "over-ceiling-attachments",
    ]);
  }
  const issues: string[] = [];
  crossValidate(parsed.data, issues, requireStaff);
  if (issues.length > 0) {
    throw new DumpValidationError("Dump validation failed", issues);
  }
  return parsed.data;
}

/** Incremental: count bytes while reading; reject over 200 MiB; then Zod. */
export async function parseJamiaDumpStream(
  stream:
    | ReadableStream<Uint8Array>
    | AsyncIterable<Uint8Array>
    | Iterable<Uint8Array>,
  opts: ParseDumpOptions = {},
): Promise<JamiaDumpV1> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const iterable = toByteIterable(stream);
  for await (const chunk of iterable) {
    total += chunk.byteLength;
    if (total > DUMP_MAX_BYTES) {
      throw new DumpValidationError(DUMP_OVER_CEILING_MESSAGE, [
        "over-ceiling-bytes",
      ]);
    }
    chunks.push(chunk);
  }
  const bytes = concat(chunks, total);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new DumpValidationError("Dump JSON is not valid", ["json"]);
  }
  if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as { attachments?: unknown }).attachments)
  ) {
    const atts = (json as { attachments: unknown[] }).attachments;
    if (atts.length > DUMP_MAX_ATTACHMENTS) {
      throw new DumpValidationError(DUMP_OVER_CEILING_MESSAGE, [
        "over-ceiling-attachments",
      ]);
    }
    for (const [i, att] of atts.entries()) {
      if (
        !att ||
        typeof att !== "object" ||
        typeof (att as { dataBase64?: unknown }).dataBase64 !== "string" ||
        (att as { dataBase64: string }).dataBase64.length === 0
      ) {
        throw new DumpValidationError("Dump validation failed", [
          `attachment-empty-bytes:${i}`,
        ]);
      }
    }
  }
  return parseJamiaDump(json, opts);
}

async function* toByteIterable(
  stream:
    | ReadableStream<Uint8Array>
    | AsyncIterable<Uint8Array>
    | Iterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  if (Symbol.asyncIterator in stream) {
    yield* stream as AsyncIterable<Uint8Array>;
    return;
  }
  if (Symbol.iterator in stream) {
    yield* stream as Iterable<Uint8Array>;
    return;
  }
  yield* streamToAsync(stream as ReadableStream<Uint8Array>);
}

async function* streamToAsync(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export const CANONICAL_DUMP_COUNTS = {
  staff: 1,
  admins: 1,
  households: 2,
  families: 2,
  memberHistory: 1,
  payments: 3,
  contributions: 1,
  expenses: 1,
  recurringTemplates: 1,
  attachments: 1,
} as const;

export const CANONICAL_DUMP_IDS = {
  staff: "staff-owner-1",
  admins: "admin-1",
  householdActive: "hh-active-1",
  householdDeleted: "hh-deleted-1",
  familyActive: "fam-active-1",
  familyDeleted: "fam-deleted-1",
  memberHistory: "mh-1",
  paymentGroupA: "pay-cg-1",
  paymentGroupB: "pay-cg-2",
  paymentLegacy: "pay-legacy-1",
  coverageGroupId: "cg-spill-1",
  contribution: "contrib-1",
  expense: "exp-mosque-1",
  template: "tmpl-1",
  attachment: "contrib-1",
} as const;

export const CANONICAL_DUMP_ACTORS = {
  createdBy: "web-admin-uid",
  recordedByGroup: "web-admin-uid",
  recordedByLegacy: "web-clerk-uid",
  addedByContribution: "web-admin-uid",
  addedByExpense: "web-admin-uid",
} as const;
