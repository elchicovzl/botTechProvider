import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma';
import { WhatsAppConfigService } from '../whatsapp-config.service';
import { QUEUES } from '../../queue';
import { BotEngineService } from '../../bots';

interface TwilioInboundData {
  MessageSid: string;
  AccountSid: string;
  From: string;               // whatsapp:+573244033035
  To: string;                 // whatsapp:+14155238886
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  ProfileName?: string;
  WaId?: string;              // Phone digits without +
  receivedAt: string;
}

interface TwilioStatusData {
  MessageSid: string;
  MessageStatus: string;      // sent | delivered | read | failed | undelivered
  To: string;
  From: string;
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
      await this.processInbound(job.data as TwilioInboundData);
    } else if (job.name === 'process-status') {
      await this.processStatus(job.data as TwilioStatusData);
    }
  }

  private async processInbound(data: TwilioInboundData): Promise<void> {
    // Strip "whatsapp:" prefix
    const fromPhone = data.From.replace('whatsapp:', '');
    const toPhone = data.To.replace('whatsapp:', '');
    const waContactId = data.WaId ?? fromPhone.replace('+', '');
    const waContactPhone = fromPhone;
    const waContactName = data.ProfileName ?? null;
    const waMessageId = data.MessageSid;

    // Idempotency
    const existing = await this.prisma.db.message.findFirst({
      where: { waMessageId },
    });
    if (existing) {
      this.logger.debug(`Duplicate message ${waMessageId} — skipping`);
      return;
    }

    // Resolve tenant: first try by the destination number, then fall back to
    // the first active config (sandbox mode — all share the same sandbox number).
    let tenantId: string;
    const config = await this.whatsappConfig.findByPhoneNumber(toPhone);

    if (config) {
      tenantId = config.tenantId;
    } else {
      this.logger.warn(
        `No tenant found for number ${toPhone} — falling back to first active config`,
      );
      const fallback = await this.prisma.db.whatsAppConfig.findFirst({
        where: { isActive: true },
      });
      if (!fallback) {
        this.logger.warn('No active WhatsApp config found — dropping message');
        return;
      }
      tenantId = fallback.tenantId;
    }

    return this.processForTenant(
      tenantId,
      waContactId,
      waContactPhone,
      waContactName,
      waMessageId,
      data,
    );
  }

  private async processForTenant(
    tenantId: string,
    waContactId: string,
    waContactPhone: string,
    waContactName: string | null,
    waMessageId: string,
    data: TwilioInboundData,
  ): Promise<void> {
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

    // Determine message type from media metadata
    const numMedia = parseInt(data.NumMedia ?? '0', 10);
    let type = 'TEXT';
    let content: string | null = data.Body ?? null;
    let mediaUrl: string | null = null;

    if (numMedia > 0 && data.MediaUrl0) {
      mediaUrl = data.MediaUrl0;
      const mediaType = data.MediaContentType0 ?? '';
      if (mediaType.startsWith('image/')) type = 'IMAGE';
      else if (mediaType.startsWith('video/')) type = 'VIDEO';
      else if (mediaType.startsWith('audio/')) type = 'AUDIO';
      else type = 'DOCUMENT';
    }

    // Persist message
    await this.prisma.db.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        waMessageId,
        direction: 'INBOUND',
        type: type as any,
        content,
        mediaUrl,
        status: 'DELIVERED',
        createdAt: now,
      },
    });

    this.logger.debug(
      `Inbound message ${waMessageId} stored for tenant ${tenantId}`,
    );

    // Trigger bot reply if conversation is in BOT mode
    if (conversation.status === 'BOT' && conversation.botId && content) {
      try {
        await this.botEngine.processMessage(tenantId, conversation.id, content);
      } catch (error) {
        this.logger.error(
          `Bot reply failed for conversation ${conversation.id}: ${error}`,
        );
        // Don't fail the job — message was already stored
      }
    }
  }

  private async processStatus(data: TwilioStatusData): Promise<void> {
    const waMessageId = data.MessageSid;

    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
      undelivered: 'FAILED',
    };

    const mappedStatus = statusMap[data.MessageStatus];
    if (!mappedStatus) return;

    const updateData: Record<string, unknown> = { status: mappedStatus };
    if (data.MessageStatus === 'sent') updateData.sentAt = new Date();
    if (data.MessageStatus === 'delivered') updateData.deliveredAt = new Date();
    if (data.MessageStatus === 'read') updateData.readAt = new Date();

    try {
      await this.prisma.db.message.update({
        where: { waMessageId },
        data: updateData,
      });
    } catch {
      this.logger.debug(
        `Status update for unknown message ${waMessageId} — skipping`,
      );
    }
  }
}
