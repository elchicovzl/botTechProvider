import { z } from 'zod';
import { ConversationStatus } from './enums';

export const conversationQuerySchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
  first: z.coerce.number().int().min(1).max(100).default(20),
  after: z.string().optional(),
  search: z.string().max(255).optional(),
});

export const updateConversationStatusSchema = z.object({
  conversationId: z.string().min(1),
  status: z.nativeEnum(ConversationStatus),
  botId: z.string().optional(),
});

export type ConversationQuery = z.infer<typeof conversationQuerySchema>;
export type UpdateConversationStatus = z.infer<typeof updateConversationStatusSchema>;
