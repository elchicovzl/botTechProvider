import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma';
import { QUEUES } from '../../queue';
import { SendMessageData } from '../whatsapp-sender.service';

@Processor(QUEUES.MESSAGE_SEND, {
  concurrency: 10,
  limiter: {
    max: 80,
    duration: 1000,
  },
})
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);
  private readonly apiKey: string;
  private readonly fromNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.apiKey = this.configService.getOrThrow('YCLOUD_API_KEY');
    this.fromNumber = this.configService.getOrThrow('YCLOUD_FROM_NUMBER');
  }

  async process(job: Job<SendMessageData>): Promise<void> {
    const { messageId, recipientPhone, type, content, mediaUrl } = job.data;

    const body = this.buildMessageBody(recipientPhone, type, content, mediaUrl);

    const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

      throw new Error(`YCloud API error ${status}: ${error}`);
    }

    const result = (await response.json()) as { id?: string; wamid?: string };

    await this.prisma.db.message.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        waMessageId: result.wamid ?? result.id ?? null,
        sentAt: new Date(),
      },
    });

    this.logger.debug(`Message ${messageId} sent via YCloud`);
  }

  private buildMessageBody(
    to: string,
    type: string,
    content: string | null,
    mediaUrl: string | null,
  ): Record<string, unknown> {
    const base = { from: this.fromNumber, to };

    switch (type) {
      case 'image':
        return {
          ...base,
          type: 'image',
          image: { link: mediaUrl, caption: content },
        };
      case 'document':
        return {
          ...base,
          type: 'document',
          document: { link: mediaUrl, caption: content },
        };
      default:
        return { ...base, type: 'text', text: { body: content } };
    }
  }
}
