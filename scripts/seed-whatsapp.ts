/**
 * Seed WhatsApp config for testing.
 * Run: cd apps/api && npx tsx ../../scripts/seed-whatsapp.ts
 */
import { createCipheriv, randomBytes } from 'crypto';

const TENANT_ID = 'cmnj09mub00043rxwvc89n2g7';
const WA_TOKEN = 'EAAMnZABFZBg0kBQvP6fVRit0QWZC4LpNPNkmbbdoZAl0wKzZBH5bNMWBmUsfBCFowO64YjfQdx2hhFjZCi0TZBxkBLLnh1I4zSuq7x92HHAZArrRVsdQ2tdNgtXhq9k8RqhcfMjlKxxngZAI75VXLRGjJf3CuGNNsSRW5iTZCiVcKVHPjsPEyf6ZA5fXZCaWHnvMkai0eAZDZD';
const PHONE_NUMBER_ID = '1039901679196039';
const WABA_ID = '2073496893474604';
const DISPLAY_PHONE = '+1 555 161 7793';

// Encrypt the token using the same algorithm as EncryptionService
const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
const key = Buffer.from(KEY_HEX, 'hex');
const iv = randomBytes(16);
const cipher = createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(WA_TOKEN, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');

const sql = `
INSERT INTO whatsapp_configs (
  id, tenant_id, waba_id, phone_number_id, display_phone_number,
  encrypted_system_token, token_iv, token_auth_tag,
  webhook_verify_token, is_active, connected_at,
  phone_verification_status, created_at, updated_at
) VALUES (
  'wa-config-test-001',
  '${TENANT_ID}',
  '${WABA_ID}',
  '${PHONE_NUMBER_ID}',
  '${DISPLAY_PHONE}',
  '${encrypted}',
  '${iv.toString('hex')}',
  '${authTag}',
  'mi_secreto_nest_2026',
  true,
  NOW(),
  'VERIFIED',
  NOW(),
  NOW()
) ON CONFLICT (tenant_id) DO UPDATE SET
  waba_id = EXCLUDED.waba_id,
  phone_number_id = EXCLUDED.phone_number_id,
  display_phone_number = EXCLUDED.display_phone_number,
  encrypted_system_token = EXCLUDED.encrypted_system_token,
  token_iv = EXCLUDED.token_iv,
  token_auth_tag = EXCLUDED.token_auth_tag,
  is_active = true,
  updated_at = NOW();
`;

console.log('Run this SQL in your database:\n');
console.log(sql);
