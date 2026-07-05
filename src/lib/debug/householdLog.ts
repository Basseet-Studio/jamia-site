/** Browser-console traces for household soft-delete debugging. Filter: jamia/hh */
const PREFIX = "[jamia/hh]";

function ingest(
  level: "log" | "warn" | "error",
  event: string,
  data?: Record<string, unknown>,
  hypothesisId?: string,
): void {
  // #region agent log
  fetch("http://127.0.0.1:7841/ingest/d6064957-b3e4-44c8-9556-962aec9bf7da", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "bf93ba",
    },
    body: JSON.stringify({
      sessionId: "bf93ba",
      runId: "post-fix",
      hypothesisId: hypothesisId ?? "H1",
      location: "householdLog.ts",
      message: event,
      data: { level, ...data },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export function hhLog(
  event: string,
  data?: Record<string, unknown>,
  hypothesisId?: string,
): void {
  if (typeof console === "undefined") return;
  const ts = new Date().toISOString();
  if (data) {
    console.log(PREFIX, ts, event, data);
  } else {
    console.log(PREFIX, ts, event);
  }
  ingest("log", event, data, hypothesisId);
}

export function hhWarn(
  event: string,
  data?: Record<string, unknown>,
  hypothesisId?: string,
): void {
  if (typeof console === "undefined") return;
  const ts = new Date().toISOString();
  console.warn(PREFIX, ts, event, data ?? "");
  ingest("warn", event, data, hypothesisId);
}

export function hhError(
  event: string,
  data?: Record<string, unknown>,
  hypothesisId?: string,
): void {
  if (typeof console === "undefined") return;
  const ts = new Date().toISOString();
  console.error(PREFIX, ts, event, data ?? "");
  ingest("error", event, data, hypothesisId);
}
