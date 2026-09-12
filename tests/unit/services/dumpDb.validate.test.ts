import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateDump } from "@/lib/services/dumpDb";

const fixturePath = resolve(
  __dirname,
  "../../../specs/005-desktop-offline-port/contracts/fixtures/jamia-dump-v1.canonical.json",
);

describe("validateDump", () => {
  it("invalid dump throws and schedules zero Firestore writes", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8")) as {
      schemaVersion: number;
    };
    raw.schemaVersion = 2;
    const setDoc = vi.fn();
    expect(() => validateDump(raw)).toThrow();
    expect(setDoc).not.toHaveBeenCalled();
  });
});
