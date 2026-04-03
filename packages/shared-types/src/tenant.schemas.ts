import { z } from 'zod';

export const updateTenantInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantInputSchema>;
