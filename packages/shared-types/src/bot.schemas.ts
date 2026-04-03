import { z } from 'zod';

export const createBotInputSchema = z.object({
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(1).max(4000),
  noMatchBehavior: z.enum(['DECLINE', 'GENERAL_KNOWLEDGE']).default('DECLINE'),
  maxContextChunks: z.coerce.number().int().min(1).max(20).default(5),
  temperature: z.coerce.number().min(0).max(2).default(0.3),
});

export const updateBotInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().min(1).max(4000).optional(),
  noMatchBehavior: z.enum(['DECLINE', 'GENERAL_KNOWLEDGE']).optional(),
  maxContextChunks: z.coerce.number().int().min(1).max(20).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
});

export type CreateBotInput = z.infer<typeof createBotInputSchema>;
export type UpdateBotInput = z.infer<typeof updateBotInputSchema>;
