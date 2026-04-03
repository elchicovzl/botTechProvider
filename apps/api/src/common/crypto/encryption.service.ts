import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * AES-256-GCM encryption service for sensitive data (WhatsApp System User tokens).
 *
 * - Encrypts with a 32-byte key from TOKEN_ENCRYPTION_KEY env var
 * - Each encryption uses a random 16-byte IV (never reused)
 * - GCM auth tag provides integrity verification
 * - Fails fast at startup if the key is missing or invalid
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm' as const;
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const keyHex = this.configService.getOrThrow<string>('TOKEN_ENCRYPTION_KEY');

    if (keyHex.length !== 64) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)',
      );
    }

    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY is not valid hex');
    }

    this.logger.log('Encryption service initialized');
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns ciphertext, IV, and auth tag — all three are needed for decryption.
   */
  encrypt(plaintext: string): EncryptedData {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    };
  }

  /**
   * Decrypt ciphertext using AES-256-GCM.
   * Requires the same IV and auth tag that were returned by encrypt().
   *
   * Throws if the auth tag doesn't match (tampered data or wrong key).
   */
  decrypt(data: EncryptedData): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(data.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
