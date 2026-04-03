import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma';
import { WhatsAppConfigService } from './whatsapp-config.service';
import { QUEUES, JOB_OPTIONS } from '../queue';

export interface SendMessageData {
  messageId: string;
  tenantId: string;
  conversationId: string;
  phoneNumberId: string;
  recipientPhone: string;
  type: 'text' | 'image' | 'document';
  content: string | null;
  mediaUrl: string | null;
}

@Injectable()
export class WhatsAppSenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappConfig: WhatsAppConfigService,
    @InjectQueue(QUEUES.MESSAGE_SEND) private readonly sendQueue: Queue,
  ) {}

  /**
   * Queue a message for sending via WhatsApp.
   * Checks session window before queuing.
   */
  async queueMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    type: 'text' | 'image' | 'document' = 'text',
    mediaUrl: string | null = null,
  ): Promise<{ messageId: string }> {
    // Get conversation + validate session window
    const conversation = await this.prisma.db.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new UnprocessableEntityException('Conversation not found');
    }

    if (
      conversation.sessionWindowExpiresAt &&
      conversation.sessionWindowExpiresAt <= new Date()
    ) {
      throw new UnprocessableEntityException(
        'Session window expired. Only template messages are allowed.',
      );
    }

    // Get WhatsApp config
    const config = await this.whatsappConfig.getConfig(tenantId);
    if (!config || !config.isActive) {
      throw new UnprocessableEntityException('WhatsApp not connected');
    }

    // Create outbound message record
    const message = await this.prisma.db.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: type.toUpperCase() as any,
        content,
        mediaUrl,
        status: 'PENDING',
      },
    });

    // Enqueue for sending
    await this.sendQueue.add(
      'send-message',
      {
        messageId: message.id,
        tenantId,
        conversationId,
        phoneNumberId: config.phoneNumberId,
        recipientPhone: conversation.waContactPhone,
        type,
        content,
        mediaUrl,
      } satisfies SendMessageData,
      {
        ...JOB_OPTIONS[QUEUES.MESSAGE_SEND],
        jobId: message.id, // Prevent duplicate sends
      },
    );

    return { messageId: message.id };
  }
}
