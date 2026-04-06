import { Injectable, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma';
import { PUB_SUB } from '../common/pubsub';
import { MessageSender } from '../common/interfaces/message-sender.interface';

@Injectable()
export class WebChatSenderService implements MessageSender {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async queueMessage(
    tenantId: string,
    conversationId: string,
    content: string,
  ): Promise<{ messageId: string }> {
    const message = await this.prisma.db.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content,
        status: 'SENT',
      },
    });

    await this.pubSub.publish('MESSAGE_ADDED', {
      messageAdded: message,
      conversationId,
    });

    return { messageId: message.id };
  }
}
