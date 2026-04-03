import { z } from 'zod';

export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registerInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  tenantName: z.string().min(1).max(255),
  tenantSlug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
      message: 'Slug must be lowercase alphanumeric with hyphens, cannot start or end with hyphen',
    }),
});

export const refreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordInputSchema = z.object({
  email: z.email(),
});

export const resetPasswordInputSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenInputSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
