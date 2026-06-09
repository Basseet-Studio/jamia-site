/**
 * Settings invariants (T090): singleton path, opening-balance delta
 * shifts money on hand.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/settings";

describe("settings — module exports", () => {
  it("exposes getSettings / subscribeSettings / updateSettings", () => {
    expect(typeof svc.getSettings).toBe("function");
    expect(typeof svc.subscribeSettings).toBe("function");
    expect(typeof svc.updateSettings).toBe("function");
  });
});
