import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DumpImportPartialFailure } from "@/components/settings/DumpImportPartialFailure";

describe("DumpImportPartialFailure", () => {
  it("shows backup filename (blocking screen, not a toast)", () => {
    render(
      <DumpImportPartialFailure backupFileName="jamia-dump-v1-2026-06-20.json" />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "jamia-dump-v1-2026-06-20.json",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "The import did not finish",
    );
  });
});
