import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    tenantId: string,
    options: {
      status?: string;
      first?: number;
      after?: string;
      search?: string;
    },
  ) {
    const { status, first = 20, after, search } = options;
    const take = Math.min(first, 100);

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { waContactPhone: { contains: search } },
        { waContactName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const cursor = after ? { id: after } : undefined;
    const skip = after ? 1 : 0;

    const [conversations, totalCount] = await Promise.all([
      this.prisma.db.conversation.findMany({
        where,
        take: take + 1, // Fetch one extra to check hasNextPage
        skip,
        cursor,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.db.conversation.count({ where }),
    ]);

    const hasNextPage = conversations.length > take;
    const edges = conversations.slice(0, take);

    return {
      edges: edges.map((conv) => ({
        node: {
          ...conv,
          isSessionOpen: conv.sessionWindowExpiresAt
            ? conv.sessionWindowExpiresAt > new Date()
            : false,
          lastMessage: conv.messages[0] ?? null,
        },
        cursor: conv.id,
      })),
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].id : null,
      },
      totalCount,
    };
  }

  async findById(tenantId: string, id: string) {
    const conversation = await this.prisma.db.conversation.findFirst({
      where: { id, tenantId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return {
      ...conversation,
      isSessionOpen: conversation.sessionWindowExpiresAt
        ? conversation.sessionWindowExpiresAt > new Date()
        : false,
    };
  }

  async getMessages(
    tenantId: string,
    conversationId: string,
    options: { first?: number; before?: string },
  ) {
    const { first = 50, before } = options;
    const take = Math.min(first, 100);

    const cursor = before ? { id: before } : undefined;
    const skip = before ? 1 : 0;

    const messages = await this.prisma.db.message.findMany({
      where: { conversationId, tenantId },
      take: take + 1,
      skip,
      cursor,
      orderBy: { createdAt: 'desc' },
    });

    const hasNextPage = messages.length > take;
    const edges = messages.slice(0, take);

    return {
      edges: edges.map((msg) => ({
        node: msg,
        cursor: msg.id,
      })),
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].id : null,
      },
    };
  }

  async updateStatus(
    tenantId: string,
    conversationId: string,
    status: string,
    botId?: string,
  ) {
    const data: Record<string, unknown> = { status };

    if (status === 'BOT' && botId) {
      data.botId = botId;
    } else if (status === 'OPEN') {
      // Human takeover — bot stops replying
      data.botId = null;
    } else if (status === 'RESOLVED') {
      data.resolvedAt = new Date();
    }

    return this.prisma.db.conversation.update({
      where: { id: conversationId, tenantId },
      data,
    });
  }
}
