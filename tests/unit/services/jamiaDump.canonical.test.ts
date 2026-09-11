import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_DUMP_ACTORS,
  CANONICAL_DUMP_COUNTS,
  CANONICAL_DUMP_IDS,
  parseJamiaDump,
  parseJamiaDumpStream,
} from "@/lib/schemas/jamiaDump";

const fixturePath = resolve(
  __dirname,
  "../../../specs/005-desktop-offline-port/contracts/fixtures/jamia-dump-v1.canonical.json",
);

describe("canonical jamia-dump fixture", () => {
  it("parses counts, ids, actors, coverageGroupId null vs set", async () => {
    const buf = await readFile(fixturePath);
    const dump = await parseJamiaDumpStream([buf], { requireStaff: true });

    expect(dump.format).toBe("jamia-dump");
    expect(dump.schemaVersion).toBe(1);
    expect(dump.source).toBe("web");
    expect(dump.staff).toHaveLength(CANONICAL_DUMP_COUNTS.staff);
    expect(dump.admins).toHaveLength(CANONICAL_DUMP_COUNTS.admins);
    expect(dump.households).toHaveLength(CANONICAL_DUMP_COUNTS.households);
    expect(dump.families).toHaveLength(CANONICAL_DUMP_COUNTS.families);
    expect(dump.memberHistory).toHaveLength(CANONICAL_DUMP_COUNTS.memberHistory);
    expect(dump.payments).toHaveLength(CANONICAL_DUMP_COUNTS.payments);
    expect(dump.contributions).toHaveLength(CANONICAL_DUMP_COUNTS.contributions);
    expect(dump.expenses).toHaveLength(CANONICAL_DUMP_COUNTS.expenses);
    expect(dump.recurringTemplates).toHaveLength(
      CANONICAL_DUMP_COUNTS.recurringTemplates,
    );
    expect(dump.attachments).toHaveLength(CANONICAL_DUMP_COUNTS.attachments);

    expect(dump.staff[0]?.id).toBe(CANONICAL_DUMP_IDS.staff);
    expect(dump.admins[0]?.id).toBe(CANONICAL_DUMP_IDS.admins);
    expect(dump.households.map((h) => h.id).sort()).toEqual(
      [CANONICAL_DUMP_IDS.householdActive, CANONICAL_DUMP_IDS.householdDeleted].sort(),
    );
    expect(
      dump.households.find((h) => h.id === CANONICAL_DUMP_IDS.householdDeleted)
        ?.active,
    ).toBe(false);
    expect(
      dump.families.find((f) => f.id === CANONICAL_DUMP_IDS.familyDeleted)
        ?.active,
    ).toBe(false);

    const grouped = dump.payments.filter((p) => p.coverageGroupId === CANONICAL_DUMP_IDS.coverageGroupId);
    expect(grouped.map((p) => p.id).sort()).toEqual(
      [CANONICAL_DUMP_IDS.paymentGroupA, CANONICAL_DUMP_IDS.paymentGroupB].sort(),
    );
    const legacy = dump.payments.find((p) => p.id === CANONICAL_DUMP_IDS.paymentLegacy);
    expect(legacy?.coverageGroupId).toBeNull();
    expect(legacy?.recordedBy).toBe(CANONICAL_DUMP_ACTORS.recordedByLegacy);
    expect(grouped[0]?.recordedBy).toBe(CANONICAL_DUMP_ACTORS.recordedByGroup);

    expect(dump.contributions[0]?.addedBy).toBe(
      CANONICAL_DUMP_ACTORS.addedByContribution,
    );
    expect(dump.expenses[0]?.id).toBe(CANONICAL_DUMP_IDS.expense);
    expect(dump.expenses[0]?.type).toBe("mosque");
    expect(dump.settings.moneyOnHand).toBe(1234.5);
  });

  it("rejects unknown keys", () => {
    const raw = {
      format: "jamia-dump",
      schemaVersion: 1,
      exportedAt: "2026-06-20T08:00:00.000Z",
      source: "web",
      extra: true,
    };
    expect(() => parseJamiaDump(raw)).toThrow();
  });
});
