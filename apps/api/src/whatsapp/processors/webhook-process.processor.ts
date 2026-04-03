import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { WhatsAppConfigService } from '../whatsapp-config.service';
import { QUEUES } from '../../queue';
import { BotEngineService } from '../../bots';

interface WaContact {
  profile: { name: string };
  wa_id: string;
}

interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
}

interface WaStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

interface WebhookJobData {
  wabaId: string;
  entry: {
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: WaContact[];
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
      field: string;
    }>;
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

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { wabaId, entry } = job.data;

    // Look up tenant by WABA ID
    const config = await this.whatsappConfig.findTenantByWabaId(wabaId);
    if (!config) {
      this.logger.warn(`Unknown WABA ID: ${wabaId} — skipping`);
      return;
    }

    const tenantId = config.tenantId;

    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;

      // Process inbound messages
      if (value.messages) {
        for (const msg of value.messages) {
          await this.processInboundMessage(tenantId, msg, value.contacts?.[0]);
        }
      }

      // Process status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await this.processStatusUpdate(status);
        }
      }
    }
  }

  private async processInboundMessage(
    tenantId: string,
    msg: WaMessage,
    contact?: WaContact,
  ): Promise<void> {
    const waContactId = msg.from;
    const waContactPhone = msg.from;
    const waContactName = contact?.profile?.name ?? null;
    const waMessageId = msg.id;

    // Idempotency check: if message already exists, skip
    const existing = await this.prisma.db.message.findFirst({
      where: { waMessageId },
    });
    if (existing) {
      this.logger.debug(`Duplicate message ${waMessageId} — skipping`);
      return;
    }

    // Upsert conversation
    const now = new Date();
    const sessionExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

    // Find active bot for this tenant
    const activeBot = await this.prisma.db.bot.findFirst({
      where: { tenantId, isActive: true, deletedAt: null },
    });

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
      // Update existing conversation
      const updateData: Record<string, unknown> = {
        sessionWindowExpiresAt: sessionExpiry,
        lastInboundAt: now,
      };

      // If conversation was RESOLVED, re-open it
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

    // Determine message type and content
    const { type, content, mediaUrl } = this.extractMessageContent(msg);

    // Create message
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
        createdAt: new Date(parseInt(msg.timestamp) * 1000),
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
        this.logger.error(`Bot reply failed for conversation ${conversation.id}: ${error}`);
        // Don't fail the webhook job — message was already stored
      }
    }
  }

  private async processStatusUpdate(status: WaStatus): Promise<void> {
    const { id: waMessageId, status: newStatus } = status;

    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };

    const mappedStatus = statusMap[newStatus];
    if (!mappedStatus) return;

    const timestampField =
      newStatus === 'sent'
        ? 'sentAt'
        : newStatus === 'delivered'
          ? 'deliveredAt'
          : newStatus === 'read'
            ? 'readAt'
            : undefined;

    const updateData: Record<string, unknown> = { status: mappedStatus };
    if (timestampField) {
      updateData[timestampField] = new Date(parseInt(status.timestamp) * 1000);
    }

    try {
      await this.prisma.db.message.update({
        where: { waMessageId },
        data: updateData,
      });
    } catch {
      // Message not found — might be from before our system or a different tenant
      this.logger.debug(`Status update for unknown message ${waMessageId}`);
    }
  }

  private extractMessageContent(
    msg: WaMessage,
  ): { type: MessageType; content: string | null; mediaUrl: string | null } {
    switch (msg.type) {
      case 'text':
        return { type: MessageType.TEXT, content: msg.text?.body ?? null, mediaUrl: null };
      case 'image':
        return {
          type: MessageType.IMAGE,
          content: msg.image?.caption ?? null,
          mediaUrl: msg.image?.id ?? null,
        };
      case 'document':
        return {
          type: MessageType.DOCUMENT,
          content: msg.document?.caption ?? msg.document?.filename ?? null,
          mediaUrl: msg.document?.id ?? null,
        };
      case 'audio':
        return { type: MessageType.AUDIO, content: null, mediaUrl: msg.audio?.id ?? null };
      case 'video':
        return {
          type: MessageType.VIDEO,
          content: msg.video?.caption ?? null,
          mediaUrl: msg.video?.id ?? null,
        };
      default:
        return { type: MessageType.UNKNOWN, content: null, mediaUrl: null };
    }
  }
}
