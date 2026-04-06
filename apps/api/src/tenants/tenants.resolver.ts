import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TenantsService } from './tenants.service';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { TenantType } from './dto';

@Resolver(() => TenantType)
export class TenantsResolver {
  constructor(private readonly tenantsService: TenantsService) {}

  private mapTenant(tenant: any): TenantType {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      widgetApiKey: tenant.widgetApiKey ?? null,
      allowedOrigins: tenant.allowedOrigins ?? [],
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

  @Query(() => TenantType)
  async myTenant(@CurrentUser() user: JwtPayload): Promise<TenantType> {
    const tenant = await this.tenantsService.findById(user.tenantId);
    return this.mapTenant(tenant);
  }

  @Mutation(() => TenantType)
  async updateTenant(
    @CurrentUser() user: JwtPayload,
    @Args('name') name: string,
  ): Promise<TenantType> {
    const tenant = await this.tenantsService.update(user.tenantId, { name });
    return this.mapTenant(tenant);
  }

  @Mutation(() => TenantType)
  async activateWhatsAppSandbox(
    @CurrentUser() user: JwtPayload,
  ): Promise<TenantType> {
    const tenant = await this.tenantsService.activateWhatsAppSandbox(user.tenantId);
    return this.mapTenant(tenant);
  }

  @Mutation(() => TenantType)
  async generateWidgetApiKey(
    @CurrentUser() user: JwtPayload,
  ): Promise<TenantType> {
    const tenant = await this.tenantsService.generateWidgetApiKey(user.tenantId);
    return this.mapTenant(tenant);
  }

  @Mutation(() => TenantType)
  async updateAllowedOrigins(
    @CurrentUser() user: JwtPayload,
    @Args('origins', { type: () => [String] }) origins: string[],
  ): Promise<TenantType> {
    const tenant = await this.tenantsService.updateAllowedOrigins(user.tenantId, origins);
    return this.mapTenant(tenant);
  }
}
