/**
 * Households — 002 delete-cascade smoke test.
 *
 * The v1 `deleteHousehold` signature is unchanged: `deleteHousehold(uid, hhId)`.
 * The cascade is extended in the implementation but the public surface
 * stays stable, so the v1 contract test still holds.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/households";

describe("households — delete cascade (002 delta)", () => {
  it("deleteHousehold keeps the v1 signature", () => {
    expect(typeof svc.deleteHousehold).toBe("function");
    expect(svc.deleteHousehold.length).toBe(2);
  });

  it("does NOT expose a per-resource delete (cascade is internal)", () => {
    expect(
      (svc as Record<string, unknown>).deleteMemberHistory,
    ).toBeUndefined();
    expect(
      (svc as Record<string, unknown>).deleteHouseholdExpenses,
    ).toBeUndefined();
  });
});
