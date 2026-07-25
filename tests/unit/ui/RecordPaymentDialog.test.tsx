/**
 * UI tests for RecordPaymentDialog — over-limit, coverage preview, print-on-save.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n";
import type { Family, Payment } from "@/lib/types";

const mockUseAuth = vi.fn(() => ({ user: { uid: "u1" }, loading: false }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("@/lib/hooks/usePermissions", () => ({
  usePermissions: () => ({
    canFinancial: true,
    canDelete: true,
    canExport: true,
    canEditFamilies: true,
    isFullAdmin: true,
  }),
}));

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
    cb(FAMILY);
    return () => {
      const i = familyListeners.indexOf(cb);
      if (i >= 0) familyListeners.splice(i, 1);
    };
  },
}));

vi.mock("@/lib/services/households", () => ({
  subscribeHousehold: (_hh: string, cb: (h: unknown) => void) => {
    cb({ id: "hh1", name: "Test HH" });
    return () => undefined;
  },
}));

const mockRecordPayment = vi.fn(async () => ({
  ids: ["new-id"],
  coverageGroupId: null,
  slots: [
    { id: "new-id", month: "2026-06", amount: 300, primary: true },
  ],
  date: new Date("2026-06-17"),
  note: null,
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
  recordPaymentWithCoverage: mockRecordPayment,
}));

vi.mock("@/components/receipts/ReceiptPrintButtons", () => ({
  ReceiptPrintButtons: () => (
    <div data-testid="rp-print-buttons">Print A4 / Print A5</div>
  ),
}));

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
  await user.click(screen.getByRole("button", { name: /record/i }));
}

import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";

beforeEach(() => {
  familyListeners.length = 0;
  paymentListeners.length = 0;
  mockRecordPayment.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RecordPaymentDialog — already paid banner", () => {
  it("shows already paid / remaining for the current month", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByTestId("rp-already-paid")).toHaveTextContent(
      /Already paid this month/,
    );
  });
});

describe("RecordPaymentDialog — over-limit indicator", () => {
  it("does NOT render the indicator when amount <= remaining capacity", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "300");
    expect(screen.queryByTestId("rp-over-limit")).toBeNull();
  });

  it("renders beyond-remaining message when amount exceeds capacity", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "600");
    await waitFor(() =>
      expect(screen.getByTestId("rp-over-limit")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("rp-over-limit")).toHaveTextContent(
      /AED 100\.00/,
    );
  });
});

describe("RecordPaymentDialog — coverage preview", () => {
  it("renders preview with auto remainder when over-limit", async () => {
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
    expect(preview.textContent).toMatch(/2026-06/);
    expect(preview.textContent).toMatch(/2026-01/);
    expect(preview.textContent).toMatch(/2026-02/);
    // Auto-fills leftover when back months unchecked → total = entered.
    expect(preview.textContent).toMatch(/AED 1,500\.00/);
    expect(screen.getByTestId("rp-fully-allocated")).toBeInTheDocument();
  });

  it("does NOT render a preview when amount is under limit", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "300");
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("rp-preview")).toBeNull();
  });

  it("selecting spillover months keeps total at entered amount", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "1500");
    await waitFor(() =>
      expect(screen.getByTestId("rp-preview")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("rp-slot-2026-01"));
    await user.click(screen.getByTestId("rp-slot-2026-02"));
    await waitFor(() => {
      const preview = screen.getByTestId("rp-preview");
      expect(preview.textContent).toMatch(/AED 1,500\.00/);
    });
    expect(screen.getByTestId("rp-fully-allocated")).toBeInTheDocument();
  });
});

describe("RecordPaymentDialog — future months", () => {
  it("does NOT render future checkbox when back cascade applies", async () => {
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
});

describe("RecordPaymentDialog — print after save", () => {
  it("shows success panel with print buttons after recording", async () => {
    renderDialog();
    const user = userEvent.setup();
    await openDialog(user);
    const amountInput = await screen.findByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, "300");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(screen.getByTestId("rp-success")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("rp-print-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("rp-done")).toBeInTheDocument();
    expect(mockRecordPayment).toHaveBeenCalled();
  });
});
