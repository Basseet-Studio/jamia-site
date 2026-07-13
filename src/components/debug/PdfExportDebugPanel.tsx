"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useContributions } from "@/lib/hooks/useContributions";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { subscribeExpenses } from "@/lib/services/expenses";
import { subscribePayments } from "@/lib/services/payments";
import { buildReceiptPdfDoc } from "@/lib/services/receiptPdf";
import {
  buildContributionReceiptContext,
  buildExpenseReceiptContext,
  buildPaymentReceiptContext,
} from "@/lib/services/receiptPdfContext";
import { printReceiptPdf } from "@/lib/services/receiptPdfClient";
import {
  describeTimestamp,
  isReceiptPdfVerbose,
  logReceiptPdf,
  setReceiptPdfVerbose,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";
import type { Expense, Family, Payment } from "@/lib/types";
import type { ReceiptPdfFormat } from "@/lib/services/receiptPdf";

type AddLog = (level: "info" | "ok" | "err", msg: string) => void;

function formatRecordDate(
  value: { toDate?: () => Date } | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : value.toDate?.();
  return d ? d.toISOString().slice(0, 10) : "—";
}

function recordLabel(
  id: string,
  amount: number,
  date: { toDate?: () => Date } | Date | null | undefined,
  extra?: string,
): string {
  const bits = [
    id.slice(0, 8),
    formatRecordDate(date),
    String(amount),
    extra,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function PdfExportDebugPanel({
  householdId,
  familyId,
  householdName,
  family,
  addLog,
}: {
  householdId: string;
  familyId: string;
  householdName: string;
  family: Family | null;
  addLog: AddLog;
}) {
  const { moh } = useMoneyOnHand();
  const { contributions } = useContributions();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [expenseId, setExpenseId] = useState("");
  const [contributionId, setContributionId] = useState("");
  const [verbose, setVerbose] = useState(false);
  const [envProbe, setEnvProbe] = useState<string | null>(null);

  const cur = moh.currency || "AED";
  const withdrawnExpenses = useMemo(
    () => expenses.filter((e) => e.withdrawn),
    [expenses],
  );

  const selectedPayment = payments.find((p) => p.id === paymentId) ?? null;
  const selectedExpense =
    withdrawnExpenses.find((e) => e.id === expenseId) ?? null;
  const selectedContribution =
    contributions.find((c) => c.id === contributionId) ?? null;

  useEffect(() => {
    setVerbose(isReceiptPdfVerbose());
  }, []);

  useEffect(() => {
    if (!householdId || !familyId) {
      setPayments([]);
      setPaymentId("");
      return;
    }
    const off = subscribePayments(householdId, familyId, (rows) => {
      setPayments(rows);
      if (rows[0]) {
        setPaymentId((prev) => prev || rows[0].id);
      }
    });
    return off;
  }, [householdId, familyId]);

  useEffect(() => {
    const off = subscribeExpenses("all", setExpenses);
    return off;
  }, []);

  useEffect(() => {
    if (withdrawnExpenses[0]) {
      setExpenseId((prev) => prev || withdrawnExpenses[0].id);
    }
  }, [withdrawnExpenses]);

  useEffect(() => {
    if (contributions[0]) {
      setContributionId((prev) => prev || contributions[0].id);
    }
  }, [contributions]);

  useEffect(() => {
    const now = Timestamp.fromDate(new Date());
    const probeDetails: Record<string, unknown> = {
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
      jsPDFType: typeof jsPDF,
    };

    try {
      const synthetic = buildReceiptPdfDoc({
        kind: "contribution",
        contribution: {
          id: "probe-synthetic",
          contributorName: "Probe User",
          amount: 1,
          date: now,
          note: null,
          addedAt: now,
          addedBy: "probe",
        },
        currency: cur,
      });
      probeDetails.syntheticBuild = "ok";
      probeDetails.syntheticFileName = synthetic.fileName;
      addLog("ok", "PDF env probe: jsPDF build succeeded (synthetic)");
      logReceiptPdf("env_probe_ok", "ok", probeDetails);
    } catch (e) {
      const err = e as Error;
      probeDetails.syntheticBuild = "failed";
      probeDetails.error = err.message;
      addLog("err", `PDF env probe failed: ${err.message}`);
      logReceiptPdf("env_probe_err", "err", probeDetails);
    }

    setEnvProbe(JSON.stringify(probeDetails, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  function toggleVerbose() {
    const next = !verbose;
    setVerbose(next);
    setReceiptPdfVerbose(next);
    addLog("info", `verbose PDF logs ${next ? "enabled" : "disabled"}`);
  }

  function testPaymentPrint(format: ReceiptPdfFormat) {
    if (!selectedPayment) {
      addLog("err", "no payment selected");
      return;
    }
    const ctx = buildPaymentReceiptContext(selectedPayment, {
      householdName,
      householdId,
      family,
      currency: cur,
    });
    addLog("info", `testing payment print ${format} id=${selectedPayment.id}`);
    logReceiptPdf("debug_test_payment", "info", {
      context: summarizeReceiptContext(ctx),
      format,
    });
    printReceiptPdf(ctx, format);
    addLog("ok", `payment print ${format} triggered id=${selectedPayment.id}`);
  }

  function testExpensePrint(format: ReceiptPdfFormat) {
    if (!selectedExpense) {
      addLog("err", "no withdrawn expense selected");
      return;
    }
    const ctx = buildExpenseReceiptContext(selectedExpense, { currency: cur });
    addLog("info", `testing expense print ${format} id=${selectedExpense.id}`);
    logReceiptPdf("debug_test_expense", "info", {
      context: summarizeReceiptContext(ctx),
      format,
    });
    printReceiptPdf(ctx, format);
    addLog("ok", `expense print ${format} triggered id=${selectedExpense.id}`);
  }

  function testContributionPrint(format: ReceiptPdfFormat) {
    if (!selectedContribution) {
      addLog("err", "no contribution selected");
      return;
    }
    const ctx = buildContributionReceiptContext(selectedContribution, {
      currency: cur,
    });
    addLog(
      "info",
      `testing contribution print ${format} id=${selectedContribution.id}`,
    );
    logReceiptPdf("debug_test_contribution", "info", {
      context: summarizeReceiptContext(ctx),
      format,
    });
    printReceiptPdf(ctx, format);
    addLog(
      "ok",
      `contribution print ${format} triggered id=${selectedContribution.id}`,
    );
  }

  function testAll(format: ReceiptPdfFormat) {
    if (selectedPayment) testPaymentPrint(format);
    if (selectedExpense) testExpensePrint(format);
    if (selectedContribution) testContributionPrint(format);
    if (!selectedPayment && !selectedExpense && !selectedContribution) {
      addLog("err", "no records available to test");
    }
  }

  const diagnostics = {
    currency: cur,
    payment: selectedPayment
      ? {
          id: selectedPayment.id,
          amount: selectedPayment.amount,
          date: describeTimestamp(selectedPayment.date, "payment.date"),
        }
      : null,
    expense: selectedExpense
      ? {
          id: selectedExpense.id,
          amount: selectedExpense.amount,
          withdrawn: selectedExpense.withdrawn,
          date: describeTimestamp(selectedExpense.date, "expense.date"),
        }
      : null,
    contribution: selectedContribution
      ? {
          id: selectedContribution.id,
          amount: selectedContribution.amount,
          date: describeTimestamp(
            selectedContribution.date,
            "contribution.date",
          ),
        }
      : null,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt print debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Uses the same receipt context builders as payments, expenses, and
          contributions pages. Opens the browser print dialog (Save as PDF
          works via the browser printer list). Check console for{" "}
          <code>[jamia/receipt-pdf]</code> logs.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={verbose ? "default" : "outline"}
            onClick={toggleVerbose}
          >
            Verbose PDF logs {verbose ? "on" : "off"}
          </Button>
        </div>

        {envProbe ? (
          <div>
            <Label>Environment probe</Label>
            <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
              {envProbe}
            </pre>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="pdf-debug-payment">Payment</Label>
            <select
              id="pdf-debug-payment"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              disabled={!householdId || !familyId}
            >
              <option value="">— pick —</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {recordLabel(p.id, p.amount, p.date, p.month)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {payments.length} payment(s) · needs household + family
            </p>
          </div>
          <div>
            <Label htmlFor="pdf-debug-expense">Expense (withdrawn)</Label>
            <select
              id="pdf-debug-expense"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={expenseId}
              onChange={(e) => setExpenseId(e.target.value)}
            >
              <option value="">— pick —</option>
              {withdrawnExpenses.map((e) => (
                <option key={e.id} value={e.id}>
                  {recordLabel(e.id, e.amount, e.date, e.name)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {withdrawnExpenses.length} withdrawn expense(s)
            </p>
          </div>
          <div>
            <Label htmlFor="pdf-debug-contribution">Contribution</Label>
            <select
              id="pdf-debug-contribution"
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              value={contributionId}
              onChange={(e) => setContributionId(e.target.value)}
            >
              <option value="">— pick —</option>
              {contributions.map((c) => (
                <option key={c.id} value={c.id}>
                  {recordLabel(c.id, c.amount, c.date, c.contributorName)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {contributions.length} contribution(s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => testPaymentPrint("a4")}
          >
            Print payment A4
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testPaymentPrint("a5")}
          >
            Print payment A5
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testExpensePrint("a4")}
          >
            Print expense A4
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testExpensePrint("a5")}
          >
            Print expense A5
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testContributionPrint("a4")}
          >
            Print contribution A4
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testContributionPrint("a5")}
          >
            Print contribution A5
          </Button>
          <Button size="sm" onClick={() => testAll("a5")}>
            Test all A5
          </Button>
          <Button size="sm" variant="secondary" onClick={() => testAll("a4")}>
            Test all A4
          </Button>
        </div>

        <div>
          <Label>Selected record diagnostics</Label>
          <pre className="mt-1 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
