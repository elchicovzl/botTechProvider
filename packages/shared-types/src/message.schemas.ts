import { z } from 'zod';

export const sendMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(4096),
});

export const messageQuerySchema = z.object({
  conversationId: z.string().min(1),
  first: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type MessageQuery = z.infer<typeof messageQuerySchema>;
