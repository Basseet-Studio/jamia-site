/**
 * Households — 002 module exports + invariant smoke tests.
 *
 * Mirrors the v1 test pattern: the module export check runs without the
 * Firestore emulator. Invariant checks for the memberCount == memberNames
 * length rule live in the e2e suite (household-members.spec.ts) since they
 * need real Firestore writes.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/households";

describe("households — module exports (002 delta)", () => {
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
