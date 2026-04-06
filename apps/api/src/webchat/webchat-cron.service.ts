import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { SessionStore, SESSION_STORE } from './session-store.interface';

@Injectable()
export class WebChatCronService {
  private readonly logger = new Logger(WebChatCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
  ) {}

  @Cron('0 */5 * * * *')
  async resolveExpiredSessions(): Promise<void> {
    const expired = await this.prisma.db.conversation.findMany({
      where: {
        channel: 'WEB',
        status: { not: 'RESOLVED' },
        sessionWindowExpiresAt: { lt: new Date() },
      },
      select: { id: true },
    });

    if (expired.length === 0) return;

    const ids = expired.map((c) => c.id);
    await this.prisma.db.conversation.updateMany({
      where: { id: { in: ids } },
      data: { status: 'RESOLVED' },
    });

    for (const { id } of expired) {
      this.sessionStore.deleteByConversationId(id);
    }

    this.logger.log(`Auto-resolved ${expired.length} expired web chat sessions`);
  }
}
