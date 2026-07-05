export type ReceiptEntityType = "payments" | "contributions" | "expenses";

const RECEIPT_ENTITY_TYPES: ReceiptEntityType[] = [
  "payments",
  "contributions",
  "expenses",
];

const RECEIPT_PATH_RE =
  /^receipts\/(payments|contributions|expenses)\/[^/]+\/[^/]+$/;

export function parseReceiptEntityType(
  value: unknown,
): ReceiptEntityType | null {
  if (typeof value !== "string") return null;
  return RECEIPT_ENTITY_TYPES.includes(value as ReceiptEntityType)
    ? (value as ReceiptEntityType)
    : null;
}

export function isValidReceiptStoragePath(path: string): boolean {
  if (!path || path.includes("..") || path.includes("\\")) return false;
  if (path.startsWith("/")) return false;
  return RECEIPT_PATH_RE.test(path);
}

export function buildReceiptStoragePath(
  entityType: ReceiptEntityType,
  docId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
  return `receipts/${entityType}/${docId}/${safeName}`;
}
