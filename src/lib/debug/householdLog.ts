/** Browser-console traces for household soft-delete debugging. Filter: jamia/hh */
const PREFIX = "[jamia/hh]";

export function hhLog(
  event: string,
  data?: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return;
  const ts = new Date().toISOString();
  if (data) {
    console.log(PREFIX, ts, event, data);
  } else {
    console.log(PREFIX, ts, event);
  }
}

export function hhWarn(
  event: string,
  data?: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return;
  const ts = new Date().toISOString();
  console.warn(PREFIX, ts, event, data ?? "");
}

export function hhError(
  event: string,
  data?: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return;
  const ts = new Date().toISOString();
  console.error(PREFIX, ts, event, data ?? "");
}
