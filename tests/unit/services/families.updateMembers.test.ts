/**
 * Families — member management (per family).
 *
 * Hierarchy: household -> family -> members. Members live on the family.
 * History is stored at `households/{hhId}/families/{fid}/memberHistory`.
 *
 * Mirrors the v1 test pattern: the module export check runs without the
 * Firestore emulator. Invariant checks for the memberCount == memberNames
 * length rule live in the e2e suite since they need real Firestore writes.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/families";

describe("families — member module exports", () => {
  it("exposes updateMembers + subscribeMemberHistory", () => {
    expect(typeof svc.updateMembers).toBe("function");
    expect(typeof svc.subscribeMemberHistory).toBe("function");
  });

  it("does NOT expose updateMemberHistory or deleteMemberHistory (append-only)", () => {
    expect(
      (svc as Record<string, unknown>).updateMemberHistory,
    ).toBeUndefined();
    expect(
      (svc as Record<string, unknown>).deleteMemberHistory,
    ).toBeUndefined();
  });

  it("does NOT expose adjustMembersMoneyOnHand (members are census metadata, not money)", () => {
    expect(
      (svc as Record<string, unknown>).adjustMembersMoneyOnHand,
    ).toBeUndefined();
  });
});

describe("households — module exports", () => {
  it("does NOT expose updateMembers (members moved to families)", async () => {
    const households = await import("@/lib/services/households");
    expect(
      (households as Record<string, unknown>).updateMembers,
    ).toBeUndefined();
    expect(
      (households as Record<string, unknown>).subscribeMemberHistory,
    ).toBeUndefined();
  });
});
