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
import { YCloudSignatureGuard } from './guards/ycloud-signature.guard';
import { QUEUES, JOB_OPTIONS } from '../queue';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUES.WEBHOOK_PROCESS) private readonly webhookQueue: Queue,
  ) {
    this.verifyToken = this.configService.get('META_WEBHOOK_VERIFY_TOKEN') ?? '';
  }

  /**
   * Meta webhook verification — kept for compatibility if switching back to Meta direct.
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
    this.logger.warn('Webhook verification failed');
    return 'Verification failed';
  }

  /**
   * Receive webhook events from YCloud.
   * Signature verified by YCloudSignatureGuard.
   * Payload enqueued to BullMQ for async processing.
   * Must return 200 quickly (YCloud requirement).
   */
  @Post('whatsapp')
  @Public()
  @UseGuards(YCloudSignatureGuard)
  @HttpCode(200)
  async receive(@Body() body: Record<string, any>): Promise<string> {
    const eventType = body?.type;

    if (eventType === 'whatsapp.inbound_message.received') {
      const msg = body.whatsappInboundMessage;
      if (msg) {
        await this.webhookQueue.add(
          'process-inbound',
          { event: body, receivedAt: new Date().toISOString() },
          JOB_OPTIONS[QUEUES.WEBHOOK_PROCESS],
        );
      }
    } else if (eventType === 'whatsapp.message.updated') {
      const msg = body.whatsappMessage;
      if (msg) {
        await this.webhookQueue.add(
          'process-status',
          { event: body, receivedAt: new Date().toISOString() },
          JOB_OPTIONS[QUEUES.WEBHOOK_PROCESS],
        );
      }
    }

    return 'EVENT_RECEIVED';
  }
}
