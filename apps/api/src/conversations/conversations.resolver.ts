import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ConversationsService } from './conversations.service';
import { WhatsAppSenderService } from '../whatsapp/whatsapp-sender.service';
import { CurrentUser, JwtPayload } from '../common/decorators';
import {
  ConversationConnectionType,
  ConversationType,
  MessageConnectionType,
  MessageType,
  SendMessageInputType,
} from './dto';

@Resolver(() => ConversationType)
export class ConversationsResolver {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly whatsappSender: WhatsAppSenderService,
  ) {}

  @Query(() => ConversationConnectionType)
  async conversations(
    @CurrentUser() user: JwtPayload,
    @Args('status', { nullable: true }) status?: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
    @Args('search', { nullable: true }) search?: string,
  ): Promise<ConversationConnectionType> {
    return this.conversationsService.findMany(user.tenantId, {
      status,
      first,
      after,
      search,
    }) as unknown as ConversationConnectionType;
  }

  @Query(() => ConversationType)
  async conversation(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
  ): Promise<ConversationType> {
    return this.conversationsService.findById(user.tenantId, id) as unknown as ConversationType;
  }

  @Query(() => MessageConnectionType)
  async messages(
    @CurrentUser() user: JwtPayload,
    @Args('conversationId') conversationId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 50 }) first?: number,
    @Args('before', { nullable: true }) before?: string,
  ): Promise<MessageConnectionType> {
    return this.conversationsService.getMessages(user.tenantId, conversationId, {
      first,
      before,
    }) as unknown as MessageConnectionType;
  }

  @Mutation(() => ConversationType)
  async updateConversationStatus(
    @CurrentUser() user: JwtPayload,
    @Args('conversationId') conversationId: string,
    @Args('status') status: string,
    @Args('botId', { nullable: true }) botId?: string,
  ): Promise<ConversationType> {
    const conv = await this.conversationsService.updateStatus(
      user.tenantId,
      conversationId,
      status,
      botId,
    );
    return {
      ...conv,
      isSessionOpen: conv.sessionWindowExpiresAt
        ? conv.sessionWindowExpiresAt > new Date()
        : false,
    } as unknown as ConversationType;
  }

  @Mutation(() => MessageType)
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Args('conversationId') conversationId: string,
    @Args('content') content: string,
  ): Promise<MessageType> {
    const result = await this.whatsappSender.queueMessage(
      user.tenantId,
      conversationId,
      content,
    );
    const message = await this.conversationsService.getMessageById(user.tenantId, result.messageId);
    return message as any;
  }
}

// Re-export for potential use elsewhere — input type is defined but mutation uses inline args
export { SendMessageInputType };
