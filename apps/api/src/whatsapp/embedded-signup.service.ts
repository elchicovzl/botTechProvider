import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppConfigService } from './whatsapp-config.service';
import { TenantsService } from '../tenants';

interface EmbeddedSignupResult {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
}

@Injectable()
export class EmbeddedSignupService {
  private readonly logger = new Logger(EmbeddedSignupService.name);
  private readonly graphApiBase = 'https://graph.facebook.com/v21.0';
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappConfig: WhatsAppConfigService,
    private readonly tenantsService: TenantsService,
  ) {
    this.appId = this.configService.getOrThrow('META_APP_ID');
    this.appSecret = this.configService.getOrThrow('META_APP_SECRET');
  }

  /**
   * Complete the Embedded Signup flow.
   *
   * Steps:
   * 1. Exchange OAuth code for short-lived user token
   * 2. Exchange short-lived token for long-lived token
   * 3. Get shared WABA ID and phone number from debug_token
   * 4. Get phone number details
   * 5. Subscribe to webhooks
   * 6. Store encrypted config
   * 7. Activate tenant
   */
  async completeSignup(
    tenantId: string,
    code: string,
  ): Promise<EmbeddedSignupResult> {
    // Step 1: Exchange code for short-lived user token
    const tokenResponse = await this.exchangeCodeForToken(code);
    const userToken = tokenResponse.access_token;

    // Step 2: Get shared WABAs from the token
    const debugInfo = await this.debugToken(userToken);
    const sharedWabas = debugInfo?.data?.granular_scopes?.find(
      (s: any) => s.scope === 'whatsapp_business_management',
    );

    const wabaId = sharedWabas?.target_ids?.[0];
    if (!wabaId) {
      throw new BadRequestException(
        'No WhatsApp Business Account found in the authorization',
      );
    }

    // Step 3: Get phone numbers for this WABA
    const phoneNumbers = await this.getPhoneNumbers(wabaId, userToken);
    const phoneNumber = phoneNumbers?.data?.[0];
    if (!phoneNumber) {
      throw new BadRequestException(
        'No phone number found for the WhatsApp Business Account',
      );
    }

    // Step 4: Subscribe the WABA to our app's webhooks
    await this.subscribeToWebhooks(wabaId, userToken);

    // Step 5: Store encrypted config
    const existingConfig = await this.whatsappConfig.getConfig(tenantId);
    if (existingConfig) {
      await this.whatsappConfig.updateConfig(tenantId, {
        wabaId,
        phoneNumberId: phoneNumber.id,
        displayPhoneNumber: phoneNumber.display_phone_number,
        systemUserToken: userToken,
      });
    } else {
      await this.whatsappConfig.createConfig(tenantId, {
        wabaId,
        phoneNumberId: phoneNumber.id,
        displayPhoneNumber: phoneNumber.display_phone_number,
        systemUserToken: userToken,
      });
    }

    // Step 6: Activate tenant
    await this.tenantsService.activate(tenantId);

    this.logger.log(
      `Embedded Signup completed for tenant ${tenantId}: WABA ${wabaId}, phone ${phoneNumber.display_phone_number}`,
    );

    return {
      wabaId,
      phoneNumberId: phoneNumber.id,
      displayPhoneNumber: phoneNumber.display_phone_number,
    };
  }

  private async exchangeCodeForToken(
    code: string,
  ): Promise<{ access_token: string }> {
    const url = new URL(`${this.graphApiBase}/oauth/access_token`);
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('client_secret', this.appSecret);
    url.searchParams.set('code', code);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Token exchange failed: ${error}`);
      throw new BadRequestException('Failed to exchange OAuth code');
    }
    return response.json() as Promise<{ access_token: string }>;
  }

  private async debugToken(userToken: string): Promise<any> {
    const url = `${this.graphApiBase}/debug_token?input_token=${userToken}&access_token=${this.appId}|${this.appSecret}`;

    const response = await fetch(url);
    if (!response.ok) {
      this.logger.error('debug_token call failed');
      throw new BadRequestException('Failed to verify token');
    }
    return response.json();
  }

  private async getPhoneNumbers(
    wabaId: string,
    token: string,
  ): Promise<{ data: Array<{ id: string; display_phone_number: string }> }> {
    const url = `${this.graphApiBase}/${wabaId}/phone_numbers`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      this.logger.error('Failed to get phone numbers');
      throw new BadRequestException('Failed to retrieve phone numbers');
    }
    return response.json() as Promise<{ data: Array<{ id: string; display_phone_number: string }> }>;
  }

  private async subscribeToWebhooks(
    wabaId: string,
    token: string,
  ): Promise<void> {
    const url = `${this.graphApiBase}/${wabaId}/subscribed_apps`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      this.logger.warn(
        'Failed to subscribe to webhooks — may need manual setup',
      );
    } else {
      this.logger.log(`Subscribed WABA ${wabaId} to webhooks`);
    }
  }
}
