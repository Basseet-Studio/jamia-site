/**
 * 003 — UI tests for RecordPaymentDialog (US1 + US3 + US4).
 *
 * Mocks the auth hook, money-on-hand hook, and the live family + payments
 * subscriptions so the test runs without Firebase. Drives the form via
 * user-event.type() and asserts the over-limit indicator, coverage preview,
 * and future-months checkbox toggle at the right moments.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n";
import type { Family, Payment } from "@/lib/types";

// --- Mocks ---------------------------------------------------------------

const mockUseAuth = vi.fn(() => ({ user: { uid: "u1" }, loading: false }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => mockUseAuth() }));

const mockUseMoneyOnHand = vi.fn(() => ({
  moh: { value: 1000, currency: "AED", asOf: null as never },
  loading: false,
}));
vi.mock("@/lib/hooks/useMoneyOnHand", () => ({
  useMoneyOnHand: () => mockUseMoneyOnHand(),
}));

const familyListeners: ((f: Family | null) => void)[] = [];
const paymentListeners: ((p: Payment[]) => void)[] = [];

const FAMILY: Family = {
  id: "fam1",
  householdId: "hh1",
  name: "Test Family",
  contributionTarget: 500,
  createdAt: { toDate: () => new Date("2026-01-15") } as never,
  createdBy: "u1",
  active: true,
  deletedAt: null,
  deletedBy: null,
  memberCount: 0,
  memberNames: [],
  updatedAt: null,
  updatedBy: null,
};

vi.mock("@/lib/services/families", () => ({
  subscribeFamily: (
    _hh: string,
    _fam: string,
    cb: (f: Family | null) => void,
  ) => {
    familyListeners.push(cb);
    // Fire synchronously so the test never has to wait for a microtask
    // before the dialog can compute the cascade plan.
    cb(FAMILY);
    return () => {
      const i = familyListeners.indexOf(cb);
      if (i >= 0) familyListeners.splice(i, 1);
    };
  },
}));

vi.mock("@/lib/services/payments", () => ({
  subscribePayments: (
    _hh: string,
    _fam: string,
    cb: (p: Payment[]) => void,
  ) => {
    paymentListeners.push(cb);
    cb([]);
    return () => {
      const i = paymentListeners.indexOf(cb);
      if (i >= 0) paymentListeners.splice(i, 1);
    };
  },
  recordPaymentWithCoverage: vi.fn(async () => ["new-id"]),
}));

// --- Test helpers --------------------------------------------------------

function renderDialog() {
  return render(
    <I18nProvider initialLocale="en">
      <RecordPaymentDialog
        householdId="hh1"
        familyId="fam1"
        familyName={FAMILY.name}
      />
    </I18nProvider>,
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  // Click the trigger button; the dialog content is mounted on open.
  await user.click(screen.getByRole("button", { name: /record payment/i }));
}

import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";

beforeEach(() => {
  familyListeners.length = 0;
  paymentListeners.length = 0;
});

// --- Tests ---------------------------------------------------------------

describe("RecordPaymentDialog — US1 over-limit indicator", () => {
  it("does NOT render the indicator when amount <= target", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "300");
    expect(screen.queryByTestId("rp-over-limit")).toBeNull();
  });

  it("renders 'Over limit by …' when amount exceeds target", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "600");
    await waitFor(() =>
      expect(screen.getByTestId("rp-over-limit")).toBeInTheDocument(),
    );
    // AED currency formatter from src/lib/utils/currency.ts → "AED 100.00"
    expect(screen.getByTestId("rp-over-limit")).toHaveTextContent(
      /AED 100\.00/,
    );
  });

  it("hides the indicator when amount drops back to target", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "700");
    await waitFor(() =>
      expect(screen.getByTestId("rp-over-limit")).toBeInTheDocument(),
    );
    await user.clear(amountInput);
    await user.type(amountInput, "500");
    await waitFor(() =>
      expect(screen.queryByTestId("rp-over-limit")).toBeNull(),
    );
  });
});

describe("RecordPaymentDialog — US3 coverage preview", () => {
  it("renders a preview block listing the cascade slots when over-limit and back unpaid", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "1500");
    await waitFor(() =>
      expect(screen.getByTestId("rp-preview")).toBeInTheDocument(),
    );
    const preview = screen.getByTestId("rp-preview");
    // current-month slot (Jun 2026)
    expect(preview.textContent).toMatch(/2026-06/);
    // back-months oldest-first (Jan, Feb)
    expect(preview.textContent).toMatch(/2026-01/);
    expect(preview.textContent).toMatch(/2026-02/);
    // total of 1500
    expect(preview.textContent).toMatch(/AED 1,500\.00/);
  });

  it("does NOT render a preview when amount is under limit", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "300");
    // Wait a tick for the plan to settle.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("rp-preview")).toBeNull();
  });

  it("renders the 'Remaining over-limit' line when partial cascade leaves a remainder", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "1700");
    await waitFor(() =>
      expect(screen.getByTestId("rp-remainder")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("rp-remainder").textContent).toMatch(
      /Remaining over-limit.*AED 1,200\.00/,
    );
  });
});

describe("RecordPaymentDialog — US4 future-months checkbox", () => {
  it("does NOT render the checkbox when back cascade applies (back is unpaid)", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "1500");
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("rp-slot-2026-07")).toBeNull();
  });

  it("renders the nearest future month pre-ticked when back is fully paid", async () => {
    renderDialog();
    // Simulate: back months Jan–May are all paid by feeding the subscription.
    const backPaid: Payment[] = [
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ].map((m) => ({
      id: `p-${m}`,
      householdId: "hh1",
      familyId: "fam1",
      amount: 500,
      date: { toDate: () => new Date(`${m}-15`) } as never,
      month: m,
      note: null,
      recordedAt: { toDate: () => new Date() } as never,
      recordedBy: "u1",
      coverageGroupId: null,
    }));
    await act(async () => {
      paymentListeners.forEach((cb) => cb(backPaid));
    });

    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "1500");
    await waitFor(() => {
      const futureSlot = screen.getByTestId("rp-slot-2026-07");
      expect(futureSlot).toBeInTheDocument();
      expect(futureSlot).toBeChecked();
    });
  });

  it("unticking the default future month updates the remaining line", async () => {
    renderDialog();
    const backPaid: Payment[] = [
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ].map((m) => ({
      id: `p-${m}`,
      householdId: "hh1",
      familyId: "fam1",
      amount: 500,
      date: { toDate: () => new Date(`${m}-15`) } as never,
      month: m,
      note: null,
      recordedAt: { toDate: () => new Date() } as never,
      recordedBy: "u1",
      coverageGroupId: null,
    }));
    await act(async () => {
      paymentListeners.forEach((cb) => cb(backPaid));
    });

    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "1500");
    await waitFor(() =>
      expect(screen.getByTestId("rp-slot-2026-07")).toBeInTheDocument(),
    );
    await waitFor(() => {
      const preview = screen.getByTestId("rp-preview");
      expect(preview.textContent).toMatch(/2026-07/);
      expect(preview.textContent).toMatch(/2026-08/);
    });
    expect(screen.getByTestId("rp-remainder").textContent).toMatch(
      /AED 500\.00/,
    );
    await user.click(screen.getByTestId("rp-slot-2026-07"));
    await waitFor(() =>
      expect(screen.getByTestId("rp-remainder").textContent).toMatch(
        /AED 1,000\.00/,
      ),
    );
  });
});
