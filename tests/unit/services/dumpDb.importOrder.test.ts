import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseJamiaDump } from "@/lib/schemas/jamiaDump";
import {
  planDumpSetOps,
  scheduledImportOps,
  validateDump,
  WRITE_BATCH_LIMIT,
} from "@/lib/services/dumpDb";

const fixturePath = resolve(
  __dirname,
  "../../../specs/005-desktop-offline-port/contracts/fixtures/jamia-dump-v1.canonical.json",
);

describe("dumpDb import order", () => {
  it("schedules staff/admins writes after financial collections", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
    const dump = parseJamiaDump(raw, { requireStaff: true });
    const ops = scheduledImportOps(dump, {
      households: [],
      families: [],
      memberHistory: [],
      payments: [],
      contributions: [],
      expenses: [],
      templates: [],
      staff: [],
      admins: [],
    });
    const lastFinancial = ops.reduce(
      (acc, op, i) => (op.phase === "financial" ? i : acc),
      -1,
    );
    const firstStaff = ops.findIndex((op) => op.phase === "staff");
    expect(firstStaff).toBeGreaterThan(-1);
    expect(lastFinancial).toBeGreaterThan(-1);
    expect(lastFinancial).toBeLessThan(firstStaff);
    expect(ops.filter((o) => o.phase === "staff").every((o) => o.kind === "set")).toBe(
      true,
    );
    const sets = planDumpSetOps(dump);
    expect(sets.every((o) => o.kind === "set")).toBe(true);
    expect(sets.some((o) => o.path.includes("staff-owner-1"))).toBe(true);
    expect(WRITE_BATCH_LIMIT).toBe(500);
  });
});

describe("validateDump", () => {
  it("rejects empty staff with zero writes (throws before any op)", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8")) as {
      staff: unknown[];
    };
    raw.staff = [];
    expect(() => validateDump(raw)).toThrow();
  });
});
