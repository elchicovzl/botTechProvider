import { z } from 'zod';

export const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),

  // Token Encryption (32-byte hex = 64 hex chars)
  TOKEN_ENCRYPTION_KEY: z.string().length(64),

  // Meta / Facebook (optional — kept for compatibility / future re-use)
  META_APP_ID: z.string().min(1).optional().default(''),
  META_APP_SECRET: z.string().min(1).optional().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional().default(''),

  // YCloud BSP
  YCLOUD_API_KEY: z.string().min(1),
  YCLOUD_WEBHOOK_SECRET: z.string().min(1),
  YCLOUD_FROM_NUMBER: z.string().min(1),

  // Ollama
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_CHAT_MODEL: z.string().default('gemma4:31b'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

  // S3 / MinIO
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_REGION: z.string().default('us-east-1'),

  // Bull Board Admin
  ADMIN_QUEUE_USER: z.string().default('admin'),
  ADMIN_QUEUE_PASS: z.string().default('admin'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  ${String(e.path.join('.'))}: ${e.message}`)
      .join('\n');
    throw new Error(`Config validation error:\n${errors}`);
  }

  return result.data;
}
