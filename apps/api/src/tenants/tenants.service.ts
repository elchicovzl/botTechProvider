import { Injectable, NotFoundException } from '@nestjs/common';
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
}
