/**
 * RecurringWarningChip — renders nothing when recurringTotal <= expectedPayments;
 * otherwise renders the destructive badge with the formatted amounts.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecurringWarningChip } from "@/components/expenses/RecurringWarningChip";
import { I18nProvider } from "@/lib/i18n";

function withI18n(node: React.ReactNode) {
  return <I18nProvider>{node}</I18nProvider>;
}

describe("RecurringWarningChip", () => {
  it("renders nothing when total does not exceed expected", () => {
    const { container } = render(
      withI18n(
        <RecurringWarningChip
          recurringTotal={100}
          expectedPayments={500}
          currency="AED"
        />,
      ),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when total equals expected", () => {
    const { container } = render(
      withI18n(
        <RecurringWarningChip
          recurringTotal={500}
          expectedPayments={500}
          currency="AED"
        />,
      ),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the destructive chip when total exceeds expected", () => {
    render(
      withI18n(
        <RecurringWarningChip
          recurringTotal={750}
          expectedPayments={500}
          currency="AED"
        />,
      ),
    );
    const chip = screen.getByTestId("recurring-warning-chip");
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toMatch(/AED\s+750\.00/);
    expect(chip.textContent).toMatch(/AED\s+500\.00/);
  });
});