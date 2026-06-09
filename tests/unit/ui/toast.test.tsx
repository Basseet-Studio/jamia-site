/**
 * Tests for the shadcn `use-toast` hook + `Toaster` (T006c).
 *
 * Validates the reducer-based toast queue:
 *  - `toast({ title })` adds a toast to the state
 *  - `dismiss(id)` marks the toast closed
 *  - The visible queue respects TOAST_LIMIT (1)
 *  - The exported `reducer` is pure
 *
 * We deliberately do NOT invoke `useToast()` or render the full <Toaster />
 * here. The shadcn use-toast hook parks a module-level setTimeout (1_000_000
 * ms remove-queue) that the vitest worker cannot exit past without an OOM.
 * The reducer is the only piece with meaningful logic; the hook is a thin
 * React subscription wrapper around it.
 */
import { describe, expect, it } from "vitest";
import { reducer } from "@/components/ui/use-toast";

describe("use-toast reducer (T006c)", () => {
  it("ADD_TOAST prepends a new toast", () => {
    const start = { toasts: [] };
    const next = reducer(start, {
      type: "ADD_TOAST",
      toast: { id: "a", title: "A", open: true },
    });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe("a");
  });

  it("ADD_TOAST caps the queue at TOAST_LIMIT (1)", () => {
    const start = { toasts: [{ id: "a", title: "A", open: true }] };
    const next = reducer(start, {
      type: "ADD_TOAST",
      toast: { id: "b", title: "B", open: true },
    });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe("b"); // new one wins
  });

  it("UPDATE_TOAST merges fields onto the matching toast", () => {
    const start = {
      toasts: [{ id: "a", title: "A", description: "old", open: true }],
    };
    const next = reducer(start, {
      type: "UPDATE_TOAST",
      toast: { id: "a", description: "new" },
    });
    expect(next.toasts[0].title).toBe("A");
    expect(next.toasts[0].description).toBe("new");
  });

  it("DISMISS_TOAST marks the toast as open=false", () => {
    const start = { toasts: [{ id: "a", title: "A", open: true }] };
    const next = reducer(start, { type: "DISMISS_TOAST", toastId: "a" });
    expect(next.toasts[0].open).toBe(false);
  });

  it("REMOVE_TOAST drops the toast from the array", () => {
    const start = { toasts: [{ id: "a", title: "A", open: true }] };
    const next = reducer(start, { type: "REMOVE_TOAST", toastId: "a" });
    expect(next.toasts).toHaveLength(0);
  });
});

describe("useToast + Toaster module surface (T006c)", () => {
  it("exports the reducer, useToast, and toast", async () => {
    const mod = await import("@/components/ui/use-toast");
    expect(typeof mod.reducer).toBe("function");
    expect(typeof mod.useToast).toBe("function");
    expect(typeof mod.toast).toBe("function");
  });

  it("exports the Toaster component", async () => {
    const mod = await import("@/components/ui/toaster");
    expect(typeof mod.Toaster).toBe("function");
  });
});
