import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TenantsService } from './tenants.service';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { TenantType } from './dto';

@Resolver(() => TenantType)
export class TenantsResolver {
  constructor(private readonly tenantsService: TenantsService) {}

  @Query(() => TenantType)
  async myTenant(@CurrentUser() user: JwtPayload): Promise<TenantType> {
    const tenant = await this.tenantsService.findById(user.tenantId);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      whatsappConfig: tenant.whatsappConfig
        ? {
            isActive: tenant.whatsappConfig.isActive,
            displayPhoneNumber: tenant.whatsappConfig.displayPhoneNumber,
            phoneVerificationStatus: tenant.whatsappConfig.phoneVerificationStatus,
            connectedAt: tenant.whatsappConfig.connectedAt,
          }
        : null,
    };
  }

  @Mutation(() => TenantType)
  async updateTenant(
    @CurrentUser() user: JwtPayload,
    @Args('name') name: string,
  ): Promise<TenantType> {
    const tenant = await this.tenantsService.update(user.tenantId, { name });
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      whatsappConfig: tenant.whatsappConfig
        ? {
            isActive: tenant.whatsappConfig.isActive,
            displayPhoneNumber: tenant.whatsappConfig.displayPhoneNumber,
            phoneVerificationStatus: tenant.whatsappConfig.phoneVerificationStatus,
            connectedAt: tenant.whatsappConfig.connectedAt,
          }
        : null,
    };
  }

  @Mutation(() => TenantType)
  async activateWhatsAppSandbox(
    @CurrentUser() user: JwtPayload,
  ): Promise<TenantType> {
    const tenant = await this.tenantsService.activateWhatsAppSandbox(user.tenantId);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      whatsappConfig: tenant.whatsappConfig
        ? {
            isActive: tenant.whatsappConfig.isActive,
            displayPhoneNumber: tenant.whatsappConfig.displayPhoneNumber,
            phoneVerificationStatus: tenant.whatsappConfig.phoneVerificationStatus,
            connectedAt: tenant.whatsappConfig.connectedAt,
          }
        : null,
    };
  }
}
