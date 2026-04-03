import { z } from 'zod';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const createDocumentUploadSchema = z.object({
  botId: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z.coerce.number().int().min(1).max(20 * 1024 * 1024), // 20MB max
});

export type CreateDocumentUpload = z.infer<typeof createDocumentUploadSchema>;
export { ALLOWED_MIME_TYPES };
