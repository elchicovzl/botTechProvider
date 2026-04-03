import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma';
import { WhatsAppConfigService } from '../whatsapp-config.service';
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
  private readonly graphApiBase = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappConfig: WhatsAppConfigService,
  ) {
    super();
  }

  async process(job: Job<SendMessageData>): Promise<void> {
    const { messageId, tenantId, phoneNumberId, recipientPhone, type, content, mediaUrl } =
      job.data;

    const token = await this.whatsappConfig.getDecryptedToken(tenantId);

    const body = this.buildMessageBody(recipientPhone, type, content, mediaUrl);

    const url = `${this.graphApiBase}/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      const status = response.status;

      // Update message as failed
      if (status !== 429) {
        await this.prisma.db.message.update({
          where: { id: messageId },
          data: { status: 'FAILED', failedReason: error },
        });
      }

      // 429 will trigger BullMQ retry via backoff
      throw new Error(`Meta API error ${status}: ${error}`);
    }

    const result = (await response.json()) as { messages?: Array<{ id: string }> };
    const waMessageId = result?.messages?.[0]?.id;

    // Update message with success
    await this.prisma.db.message.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        waMessageId: waMessageId ?? null,
        sentAt: new Date(),
      },
    });

    this.logger.debug(`Message ${messageId} sent: ${waMessageId}`);
  }

  private buildMessageBody(
    to: string,
    type: string,
    content: string | null,
    mediaUrl: string | null,
  ): Record<string, unknown> {
    const base = {
      messaging_product: 'whatsapp',
      to,
    };

    switch (type) {
      case 'text':
        return { ...base, type: 'text', text: { body: content } };
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
