import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateBotInputType, UpdateBotInputType } from './dto';

const BOT_INCLUDE = {
  _count: { select: { documents: true } },
} as const;

function mapBot(bot: {
  id: string;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  noMatchBehavior: string;
  maxContextChunks: number;
  temperature: number;
  createdAt: Date;
  updatedAt: Date;
  _count: { documents: number };
}) {
  return {
    id: bot.id,
    name: bot.name,
    systemPrompt: bot.systemPrompt,
    isActive: bot.isActive,
    noMatchBehavior: bot.noMatchBehavior,
    maxContextChunks: bot.maxContextChunks,
    temperature: bot.temperature,
    documentCount: bot._count.documents,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const bots = await this.prisma.db.bot.findMany({
      where: { tenantId, deletedAt: null },
      include: BOT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return bots.map(mapBot);
  }

  async findById(tenantId: string, id: string) {
    const bot = await this.prisma.db.bot.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: BOT_INCLUDE,
    });
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    return mapBot(bot);
  }

  async create(tenantId: string, input: CreateBotInputType) {
    const bot = await this.prisma.db.bot.create({
      data: {
        tenantId,
        name: input.name,
        systemPrompt: input.systemPrompt,
        isActive: false,
        ...(input.noMatchBehavior !== undefined && {
          noMatchBehavior: input.noMatchBehavior,
        }),
        ...(input.maxContextChunks !== undefined && {
          maxContextChunks: input.maxContextChunks,
        }),
        ...(input.temperature !== undefined && {
          temperature: input.temperature,
        }),
      },
      include: BOT_INCLUDE,
    });
    return mapBot(bot);
  }

  async update(tenantId: string, id: string, input: UpdateBotInputType) {
    await this.findById(tenantId, id);

    const bot = await this.prisma.db.bot.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.systemPrompt !== undefined && {
          systemPrompt: input.systemPrompt,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.noMatchBehavior !== undefined && {
          noMatchBehavior: input.noMatchBehavior,
        }),
        ...(input.maxContextChunks !== undefined && {
          maxContextChunks: input.maxContextChunks,
        }),
        ...(input.temperature !== undefined && {
          temperature: input.temperature,
        }),
      },
      include: BOT_INCLUDE,
    });
    return mapBot(bot);
  }

  async activateBot(tenantId: string, botId: string) {
    await this.findById(tenantId, botId);

    // Use functional transaction to handle the extended client's type constraints
    const activated = await this.prisma.$transaction(async (tx) => {
      await (tx as unknown as typeof this.prisma.db).bot.updateMany({
        where: { tenantId, deletedAt: null, isActive: true },
        data: { isActive: false },
      });
      return (tx as unknown as typeof this.prisma.db).bot.update({
        where: { id: botId },
        data: { isActive: true },
        include: BOT_INCLUDE,
      });
    });

    return mapBot(activated as Parameters<typeof mapBot>[0]);
  }

  async deactivateBot(tenantId: string, botId: string) {
    await this.findById(tenantId, botId);

    const bot = await this.prisma.db.bot.update({
      where: { id: botId },
      data: { isActive: false },
      include: BOT_INCLUDE,
    });
    return mapBot(bot);
  }

  async deleteBot(tenantId: string, botId: string) {
    const bot = await this.findById(tenantId, botId);

    if (bot.isActive) {
      throw new BadRequestException('CANNOT_DELETE_ACTIVE_BOT');
    }

    const deleted = await this.prisma.db.bot.update({
      where: { id: botId },
      data: { deletedAt: new Date() },
      include: BOT_INCLUDE,
    });
    return mapBot(deleted);
  }
}
