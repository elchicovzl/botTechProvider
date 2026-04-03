import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma';
import { QUEUES } from '../../queue';
import { SendMessageData } from '../whatsapp-sender.service';

@Processor(QUEUES.MESSAGE_SEND, {
  concurrency: 10,
  limiter: { max: 80, duration: 1000 },
})
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.accountSid = this.configService.getOrThrow('TWILIO_ACCOUNT_SID');
    this.authToken = this.configService.getOrThrow('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.getOrThrow('TWILIO_WHATSAPP_NUMBER');
  }

  async process(job: Job<SendMessageData>): Promise<void> {
    const { messageId, recipientPhone, content, mediaUrl } = job.data;

    const params = new URLSearchParams();
    params.append('From', `whatsapp:${this.fromNumber}`);
    params.append('To', `whatsapp:${recipientPhone}`);
    if (content) params.append('Body', content);
    if (mediaUrl) params.append('MediaUrl', mediaUrl);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      'base64',
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      const status = response.status;

      // Mark as failed unless it's a rate-limit (BullMQ will retry via backoff)
      if (status !== 429) {
        await this.prisma.db.message.update({
          where: { id: messageId },
          data: { status: 'FAILED', failedReason: error },
        });
      }

      throw new Error(`Twilio API error ${status}: ${error}`);
    }

    const result = (await response.json()) as { sid?: string };

    await this.prisma.db.message.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        waMessageId: result.sid ?? null,
        sentAt: new Date(),
      },
    });

    this.logger.debug(
      `Message ${messageId} sent via Twilio: ${result.sid ?? 'no-sid'}`,
    );
  }
}
