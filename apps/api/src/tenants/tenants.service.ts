import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string) {
    const tenant = await this.prisma.db.tenant.findUnique({
      where: { id: tenantId },
      include: { whatsappConfig: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(tenantId: string, data: { name?: string }) {
    return this.prisma.db.tenant.update({
      where: { id: tenantId },
      data,
      include: { whatsappConfig: true },
    });
  }

  async activate(tenantId: string) {
    return this.prisma.db.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE' },
    });
  }

  async generateWidgetApiKey(tenantId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const key = `wk_${crypto.randomBytes(16).toString('hex')}`;
      try {
        return await this.prisma.db.tenant.update({
          where: { id: tenantId },
          data: { widgetApiKey: key },
          include: { whatsappConfig: true },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 2) continue; // unique collision, retry
        throw err?.code === 'P2002'
          ? new InternalServerErrorException('Failed to generate unique API key')
          : err;
      }
    }
    throw new InternalServerErrorException('Failed to generate unique API key');
  }

  async updateAllowedOrigins(tenantId: string, origins: string[]) {
    const normalized = origins.map((o) => {
      try {
        return new URL(o).origin;
      } catch {
        throw new BadRequestException(`Invalid origin: "${o}". Must be a valid URL (e.g., https://example.com)`);
      }
    });

    const unique = [...new Set(normalized)];

    return this.prisma.db.tenant.update({
      where: { id: tenantId },
      data: { allowedOrigins: unique },
      include: { whatsappConfig: true },
    });
  }

  async activateWhatsAppSandbox(tenantId: string) {
    const sandboxNumber = '+14155238886';

    await this.prisma.db.whatsAppConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        wabaId: 'twilio-sandbox',
        phoneNumberId: '14155238886',
        displayPhoneNumber: sandboxNumber,
        encryptedSystemToken: 'sandbox',
        tokenIv: 'sandbox',
        tokenAuthTag: 'sandbox',
        webhookVerifyToken: 'sandbox',
        isActive: true,
        connectedAt: new Date(),
        phoneVerificationStatus: 'VERIFIED',
      },
      update: {
        isActive: true,
        connectedAt: new Date(),
      },
    });

    return this.prisma.db.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE' },
      include: { whatsappConfig: true },
    });
  }
}
