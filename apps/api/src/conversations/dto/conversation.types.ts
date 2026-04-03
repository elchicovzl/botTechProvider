import { ObjectType, Field, ID, InputType, registerEnumType } from '@nestjs/graphql';

// Register enums for GraphQL
enum GqlConversationStatus {
  OPEN = 'OPEN',
  BOT = 'BOT',
  RESOLVED = 'RESOLVED',
}

registerEnumType(GqlConversationStatus, { name: 'ConversationStatus' });

@ObjectType()
export class MessageType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  waMessageId?: string | null;

  @Field()
  direction!: string;

  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  content?: string | null;

  @Field(() => String, { nullable: true })
  mediaUrl?: string | null;

  @Field()
  status!: string;

  @Field(() => Date, { nullable: true })
  sentAt?: Date | null;

  @Field(() => Date, { nullable: true })
  deliveredAt?: Date | null;

  @Field(() => Date, { nullable: true })
  readAt?: Date | null;

  @Field(() => String, { nullable: true })
  failedReason?: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class ConversationType {
  @Field(() => ID)
  id!: string;

  @Field()
  waContactPhone!: string;

  @Field(() => String, { nullable: true })
  waContactName?: string | null;

  @Field(() => GqlConversationStatus)
  status!: GqlConversationStatus;

  @Field(() => String, { nullable: true })
  botId?: string | null;

  @Field(() => Date, { nullable: true })
  sessionWindowExpiresAt?: Date | null;

  @Field(() => Date, { nullable: true })
  lastInboundAt?: Date | null;

  @Field()
  isSessionOpen!: boolean;

  @Field(() => MessageType, { nullable: true })
  lastMessage?: MessageType | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class PageInfoType {
  @Field()
  hasNextPage!: boolean;

  @Field(() => String, { nullable: true })
  endCursor?: string | null;
}

@ObjectType()
export class ConversationEdgeType {
  @Field(() => ConversationType)
  node!: ConversationType;

  @Field()
  cursor!: string;
}

@ObjectType()
export class ConversationConnectionType {
  @Field(() => [ConversationEdgeType])
  edges!: ConversationEdgeType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;

  @Field()
  totalCount!: number;
}

@ObjectType()
export class MessageEdgeType {
  @Field(() => MessageType)
  node!: MessageType;

  @Field()
  cursor!: string;
}

@ObjectType()
export class MessageConnectionType {
  @Field(() => [MessageEdgeType])
  edges!: MessageEdgeType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;
}

@InputType()
export class SendMessageInputType {
  @Field()
  conversationId!: string;

  @Field()
  content!: string;

  @Field(() => String, { nullable: true, defaultValue: 'text' })
  type?: string;

  @Field(() => String, { nullable: true })
  mediaUrl?: string;
}
