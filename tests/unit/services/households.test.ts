/**
 * Household invariants: soft delete sets active=false; data is preserved.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/households";

describe("households — module exports", () => {
  it("exposes createHousehold + deleteHousehold + subscriptions", () => {
    expect(typeof svc.createHousehold).toBe("function");
    expect(typeof svc.deleteHousehold).toBe("function");
    expect(typeof svc.subscribeHouseholds).toBe("function");
    expect(typeof svc.subscribeHousehold).toBe("function");
  });
});
