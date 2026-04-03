import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from '../common/decorators';
import { MetaSignatureGuard } from './guards/meta-signature.guard';
import { QUEUES, JOB_OPTIONS } from '../queue';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUES.WEBHOOK_PROCESS) private readonly webhookQueue: Queue,
  ) {
    this.verifyToken = this.configService.getOrThrow('META_WEBHOOK_VERIFY_TOKEN');
  }

  /**
   * Webhook verification — Meta sends GET to verify the endpoint.
   * Must return hub.challenge to confirm subscription.
   */
  @Get('whatsapp')
  @Public()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }
    this.logger.warn(`Webhook verification failed: mode=${mode}`);
    return 'Verification failed';
  }

  /**
   * Receive webhook events from Meta.
   * Signature verified by MetaSignatureGuard.
   * Payload enqueued to BullMQ for async processing.
   * Must return 200 within 20 seconds (Meta requirement).
   */
  @Post('whatsapp')
  @Public()
  @UseGuards(MetaSignatureGuard)
  @HttpCode(200)
  async receive(@Body() body: Record<string, any>): Promise<string> {
    const entries = body?.entry;
    if (!Array.isArray(entries) || entries.length === 0) {
      return 'EVENT_RECEIVED';
    }

    for (const entry of entries) {
      const wabaId = entry.id;
      if (!wabaId) continue;

      await this.webhookQueue.add(
        'process-webhook',
        {
          wabaId,
          entry,
          receivedAt: new Date().toISOString(),
        },
        JOB_OPTIONS[QUEUES.WEBHOOK_PROCESS],
      );
    }

    return 'EVENT_RECEIVED';
  }
}
