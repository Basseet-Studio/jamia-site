import { z } from "zod";

export const attachmentInputSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
