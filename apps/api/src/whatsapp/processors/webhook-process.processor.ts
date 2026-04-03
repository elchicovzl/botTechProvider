import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { WhatsAppConfigService } from '../whatsapp-config.service';
import { QUEUES } from '../../queue';
import { BotEngineService } from '../../bots';

interface YCloudInboundMessage {
  id: string;
  wabaId: string;
  from: string;
  to: string;
  customerProfile?: { name: string };
  sendTime: string;
  type: string;
  text?: { body: string };
  image?: { id: string; link?: string; caption?: string };
  document?: { id: string; link?: string; filename?: string; caption?: string };
  audio?: { id: string; link?: string };
  video?: { id: string; link?: string; caption?: string };
}

interface YCloudInboundEvent {
  event: {
    id: string;
    type: 'whatsapp.inbound_message.received';
    whatsappInboundMessage: YCloudInboundMessage;
  };
  receivedAt: string;
}

interface YCloudStatusEvent {
  event: {
    id: string;
    type: 'whatsapp.message.updated';
    whatsappMessage: {
      id: string;
      wamid?: string;
      status: string;
      sendTime?: string;
      totalPrice?: string;
      currency?: string;
    };
  };
  receivedAt: string;
}

@Processor(QUEUES.WEBHOOK_PROCESS)
export class WebhookProcessProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappConfig: WhatsAppConfigService,
    @Inject(forwardRef(() => BotEngineService))
    private readonly botEngine: BotEngineService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'process-inbound') {
      await this.processInbound(job.data as YCloudInboundEvent);
    } else if (job.name === 'process-status') {
      await this.processStatus(job.data as YCloudStatusEvent);
    }
  }

  private async processInbound(data: YCloudInboundEvent): Promise<void> {
    const msg = data.event.whatsappInboundMessage;
    const wabaId = msg.wabaId;

    // Look up tenant by WABA ID
    const config = await this.whatsappConfig.findTenantByWabaId(wabaId);
    if (!config) {
      this.logger.warn(`Unknown WABA ID: ${wabaId} — skipping`);
      return;
    }

    const tenantId = config.tenantId;
    const waContactId = msg.from;
    const waContactPhone = msg.from;
    const waContactName = msg.customerProfile?.name ?? null;
    const waMessageId = msg.id;

    // Idempotency check
    const existing = await this.prisma.db.message.findFirst({
      where: { waMessageId },
    });
    if (existing) {
      this.logger.debug(`Duplicate message ${waMessageId} — skipping`);
      return;
    }

    // Find active bot for this tenant
    const activeBot = await this.prisma.db.bot.findFirst({
      where: { tenantId, isActive: true, deletedAt: null },
    });

    const now = new Date();
    const sessionExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

    // Upsert conversation
    let conversation = await this.prisma.db.conversation.findFirst({
      where: { tenantId, waContactId },
    });

    if (!conversation) {
      conversation = await this.prisma.db.conversation.create({
        data: {
          tenantId,
          waContactId,
          waContactPhone,
          waContactName,
          status: activeBot ? 'BOT' : 'OPEN',
          botId: activeBot?.id ?? null,
          sessionWindowExpiresAt: sessionExpiry,
          lastInboundAt: now,
        },
      });
    } else {
      const updateData: Record<string, unknown> = {
        sessionWindowExpiresAt: sessionExpiry,
        lastInboundAt: now,
      };

      // Re-open resolved conversations
      if (conversation.status === 'RESOLVED') {
        updateData.status = activeBot ? 'BOT' : 'OPEN';
        updateData.botId = activeBot?.id ?? null;
      }

      if (waContactName && !conversation.waContactName) {
        updateData.waContactName = waContactName;
      }

      conversation = await this.prisma.db.conversation.update({
        where: { id: conversation.id },
        data: updateData,
      });
    }

    // Extract content
    const { type, content, mediaUrl } = this.extractContent(msg);

    // Create message record
    await this.prisma.db.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        waMessageId,
        direction: 'INBOUND',
        type,
        content,
        mediaUrl,
        status: 'DELIVERED',
        createdAt: msg.sendTime ? new Date(msg.sendTime) : now,
      },
    });

    this.logger.debug(
      `Inbound message ${waMessageId} stored for tenant ${tenantId}`,
    );

    // Trigger bot reply if conversation is in BOT mode
    if (conversation.status === 'BOT' && conversation.botId) {
      try {
        await this.botEngine.processMessage(tenantId, conversation.id, content ?? '');
      } catch (error) {
        this.logger.error(
          `Bot reply failed for conversation ${conversation.id}: ${error}`,
        );
        // Don't fail the job — message was already stored
      }
    }
  }

  private async processStatus(data: YCloudStatusEvent): Promise<void> {
    const msg = data.event.whatsappMessage;
    // YCloud sends wamid (WhatsApp's native message ID) or its own id
    const waMessageId = msg.wamid ?? msg.id;

    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };

    const mappedStatus = statusMap[msg.status];
    if (!mappedStatus) return;

    const updateData: Record<string, unknown> = { status: mappedStatus };
    if (msg.status === 'sent') updateData.sentAt = new Date();
    if (msg.status === 'delivered') updateData.deliveredAt = new Date();
    if (msg.status === 'read') updateData.readAt = new Date();

    try {
      await this.prisma.db.message.update({
        where: { waMessageId },
        data: updateData,
      });
    } catch {
      this.logger.debug(`Status update for unknown message ${waMessageId}`);
    }
  }

  private extractContent(msg: YCloudInboundMessage): {
    type: MessageType;
    content: string | null;
    mediaUrl: string | null;
  } {
    switch (msg.type) {
      case 'text':
        return {
          type: MessageType.TEXT,
          content: msg.text?.body ?? null,
          mediaUrl: null,
        };
      case 'image':
        return {
          type: MessageType.IMAGE,
          content: msg.image?.caption ?? null,
          mediaUrl: msg.image?.link ?? msg.image?.id ?? null,
        };
      case 'document':
        return {
          type: MessageType.DOCUMENT,
          content: msg.document?.caption ?? msg.document?.filename ?? null,
          mediaUrl: msg.document?.link ?? msg.document?.id ?? null,
        };
      case 'audio':
        return {
          type: MessageType.AUDIO,
          content: null,
          mediaUrl: msg.audio?.link ?? msg.audio?.id ?? null,
        };
      case 'video':
        return {
          type: MessageType.VIDEO,
          content: msg.video?.caption ?? null,
          mediaUrl: msg.video?.link ?? msg.video?.id ?? null,
        };
      default:
        return { type: MessageType.UNKNOWN, content: null, mediaUrl: null };
    }
  }
}
