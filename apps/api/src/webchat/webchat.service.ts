import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma';
import { BotEngineService } from '../bots';
import { PUB_SUB } from '../common/pubsub';
import { SessionStore, SESSION_STORE } from './session-store.interface';

@Injectable()
export class WebChatService {
  private readonly logger = new Logger(WebChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botEngine: BotEngineService,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // ─── createSession ────────────────────────────────────────────────────────

  async createSession(
    tenantSlug: string,
    visitorId: string,
    visitorName?: string,
  ): Promise<{ sessionToken: string; conversationId: string }> {
    if (!tenantSlug || !visitorId) {
      throw new BadRequestException('tenantSlug and visitorId are required');
    }

    // 1. Find tenant by slug
    const tenant = await this.prisma.db.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantSlug}' not found`);
    }

    // 2. Normalize visitorId
    const normalizedVisitorId = visitorId.toLowerCase();

    // 3. Find active bot for tenant
    const bot = await this.prisma.db.bot.findFirst({
      where: { tenantId: tenant.id, isActive: true, deletedAt: null },
    });

    // 4. Upsert conversation using @@unique([tenantId, webVisitorId])
    const conversation = await this.prisma.db.conversation.upsert({
      where: {
        tenantId_webVisitorId: {
          tenantId: tenant.id,
          webVisitorId: normalizedVisitorId,
        },
      },
      update: {
        // Re-activate resolved conversations; keep BOT/OPEN as-is
        status: bot ? 'BOT' : 'OPEN',
        botId: bot?.id ?? null,
        webContactName: visitorName ?? undefined,
        sessionWindowExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        updatedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        channel: 'WEB',
        webVisitorId: normalizedVisitorId,
        webContactName: visitorName ?? null,
        status: bot ? 'BOT' : 'OPEN',
        botId: bot?.id ?? null,
        sessionWindowExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // 5. Generate session token
    const sessionToken = crypto.randomUUID();

    // 6. Store in session store
    this.sessionStore.set(sessionToken, {
      conversationId: conversation.id,
      tenantId: tenant.id,
    });

    // 7. Return
    return { sessionToken, conversationId: conversation.id };
  }

  // ─── sendMessage ──────────────────────────────────────────────────────────

  async sendMessage(
    sessionToken: string,
    content: string,
  ): Promise<{ messageId: string }> {
    // 1. Get session
    const session = this.sessionStore.get(sessionToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // 2. Load conversation
    const conversation = await this.prisma.db.conversation.findFirst({
      where: { id: session.conversationId, tenantId: session.tenantId },
    });
    if (!conversation) {
      throw new UnauthorizedException('Conversation not found');
    }
    if (conversation.status === 'RESOLVED') {
      throw new ConflictException('Conversation is already resolved');
    }

    // 3. Validate content
    const trimmed = (content ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Message content cannot be empty');
    }
    if (trimmed.length > 4000) {
      throw new BadRequestException('Message content exceeds 4000 characters');
    }

    // 4. Create INBOUND message
    const message = await this.prisma.db.message.create({
      data: {
        tenantId: session.tenantId,
        conversationId: session.conversationId,
        direction: 'INBOUND',
        type: 'TEXT',
        content: trimmed,
        status: 'DELIVERED',
      },
    });

    // 5. Update conversation window
    await this.prisma.db.conversation.update({
      where: { id: session.conversationId },
      data: {
        sessionWindowExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastInboundAt: new Date(),
      },
    });

    // 6. Publish MESSAGE_ADDED PubSub event
    await this.pubSub.publish('MESSAGE_ADDED', {
      messageAdded: message,
      conversationId: session.conversationId,
    });

    // 7. Fire-and-forget bot processing
    if (conversation.status === 'BOT' && conversation.botId) {
      this.botEngine
        .processMessage(session.tenantId, session.conversationId, trimmed)
        .catch((err) => {
          this.logger.error(`BotEngine error for conversation ${session.conversationId}: ${err}`);
        });
    }

    return { messageId: message.id };
  }

  // ─── getMessages ──────────────────────────────────────────────────────────

  async getMessages(
    sessionToken: string,
    limit = 50,
    before?: string,
  ): Promise<{ messages: unknown[]; hasMore: boolean }> {
    // 1. Validate session
    const session = this.sessionStore.get(sessionToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // 2. Clamp limit
    const clampedLimit = Math.min(Math.max(limit, 1), 100);

    // 3. Query with cursor pagination
    const messages = await this.prisma.db.message.findMany({
      where: {
        conversationId: session.conversationId,
        tenantId: session.tenantId,
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: clampedLimit + 1,
    });

    const hasMore = messages.length > clampedLimit;
    if (hasMore) messages.pop();

    return { messages: messages.reverse(), hasMore };
  }

  // ─── verifySession ────────────────────────────────────────────────────────

  verifySession(sessionToken: string): { conversationId: string; tenantId: string } {
    const session = this.sessionStore.get(sessionToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    return session;
  }

  // ─── getPubSub ────────────────────────────────────────────────────────────

  getPubSub(): PubSub {
    return this.pubSub;
  }
}
