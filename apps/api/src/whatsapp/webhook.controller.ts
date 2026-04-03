import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from '../common/decorators';
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
   * Meta webhook verification — kept for future compatibility.
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
    return 'OK';
  }

  /**
   * Receive inbound messages and status updates from Twilio.
   * Twilio sends application/x-www-form-urlencoded (NOT JSON).
   * NestJS + Express parses this via the urlencoded middleware added in main.ts.
   *
   * Signature guard (TwilioSignatureGuard) is intentionally omitted here for
   * sandbox / local testing (ngrok URL reconstruction is error-prone during dev).
   * Re-enable @UseGuards(TwilioSignatureGuard) before deploying to production.
   *
   * Returns empty TwiML — no auto-reply, replies are sent asynchronously.
   */
  @Post('whatsapp')
  @Public()
  @HttpCode(200)
  async receive(@Body() body: Record<string, string>): Promise<string> {
    const messageSid = body.MessageSid;
    const from = body.From; // whatsapp:+573244033035
    const messageBody = body.Body;
    const messageStatus = body.MessageStatus;

    if (messageSid && from && messageBody !== undefined) {
      // Inbound message
      this.logger.log(
        `Inbound from ${from}: ${(messageBody ?? '').substring(0, 50)}`,
      );
      await this.webhookQueue.add(
        'process-inbound',
        { ...body, receivedAt: new Date().toISOString() },
        JOB_OPTIONS[QUEUES.WEBHOOK_PROCESS],
      );
    } else if (messageSid && messageStatus) {
      // Status update (delivered, read, failed, etc.)
      this.logger.debug(`Status update for ${messageSid}: ${messageStatus}`);
      await this.webhookQueue.add(
        'process-status',
        { ...body, receivedAt: new Date().toISOString() },
        JOB_OPTIONS[QUEUES.WEBHOOK_PROCESS],
      );
    }

    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
}
