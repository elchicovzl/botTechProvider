import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { EncryptionService } from '../common/crypto';
import { randomUUID } from 'crypto';

@Injectable()
export class WhatsAppConfigService {
  private readonly logger = new Logger(WhatsAppConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Store WhatsApp configuration for a tenant after Embedded Signup.
   * Encrypts the System User token before storage.
   */
  async createConfig(
    tenantId: string,
    data: {
      wabaId: string;
      phoneNumberId: string;
      displayPhoneNumber?: string;
      systemUserToken: string;
    },
  ) {
    const encrypted = this.encryption.encrypt(data.systemUserToken);

    const config = await this.prisma.db.whatsAppConfig.create({
      data: {
        tenantId,
        wabaId: data.wabaId,
        phoneNumberId: data.phoneNumberId,
        displayPhoneNumber: data.displayPhoneNumber ?? null,
        encryptedSystemToken: encrypted.ciphertext,
        tokenIv: encrypted.iv,
        tokenAuthTag: encrypted.authTag,
        webhookVerifyToken: randomUUID(),
        isActive: true,
        connectedAt: new Date(),
      },
    });

    this.logger.log(`WhatsApp config created for tenant ${tenantId}`);
    return config;
  }

  /**
   * Update WhatsApp config (e.g., on re-connection).
   * Re-encrypts the token.
   */
  async updateConfig(
    tenantId: string,
    data: {
      wabaId?: string;
      phoneNumberId?: string;
      displayPhoneNumber?: string;
      systemUserToken?: string;
    },
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.wabaId) updateData.wabaId = data.wabaId;
    if (data.phoneNumberId) updateData.phoneNumberId = data.phoneNumberId;
    if (data.displayPhoneNumber !== undefined)
      updateData.displayPhoneNumber = data.displayPhoneNumber;

    if (data.systemUserToken) {
      const encrypted = this.encryption.encrypt(data.systemUserToken);
      updateData.encryptedSystemToken = encrypted.ciphertext;
      updateData.tokenIv = encrypted.iv;
      updateData.tokenAuthTag = encrypted.authTag;
    }

    return this.prisma.db.whatsAppConfig.update({
      where: { tenantId },
      data: updateData,
    });
  }

  /**
   * Get the decrypted System User token for a tenant.
   * Used when sending messages via Meta Graph API.
   */
  async getDecryptedToken(tenantId: string): Promise<string> {
    const config = await this.prisma.db.whatsAppConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new NotFoundException('WhatsApp not configured for this tenant');
    }

    return this.encryption.decrypt({
      ciphertext: config.encryptedSystemToken,
      iv: config.tokenIv,
      authTag: config.tokenAuthTag,
    });
  }

  /**
   * Get WhatsApp config for a tenant (without decrypted token).
   */
  async getConfig(tenantId: string) {
    return this.prisma.db.whatsAppConfig.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Find tenant by WABA ID (used in webhook processing).
   * No tenant context — this is called from the webhook processor
   * which needs to look up which tenant owns a WABA.
   */
  async findTenantByWabaId(wabaId: string) {
    const config = await this.prisma.db.whatsAppConfig.findFirst({
      where: { wabaId },
      include: { tenant: true },
    });
    return config;
  }

  /**
   * Find config by phone number ID (used in message sending).
   */
  async findByPhoneNumberId(phoneNumberId: string) {
    return this.prisma.db.whatsAppConfig.findFirst({
      where: { phoneNumberId },
    });
  }

  /**
   * Find tenant by WhatsApp phone number.
   * Used in Twilio webhook processing to map the destination number to a tenant.
   * Accepts the number with or without the "whatsapp:" prefix and the leading "+".
   */
  async findByPhoneNumber(phone: string) {
    const normalized = phone.replace('whatsapp:', '').replace('+', '');
    return this.prisma.db.whatsAppConfig.findFirst({
      where: {
        OR: [
          { displayPhoneNumber: { contains: normalized } },
          { phoneNumberId: { contains: normalized } },
        ],
      },
      include: { tenant: true },
    });
  }
}
