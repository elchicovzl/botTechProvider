import { ObjectType, InputType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class BotType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  systemPrompt!: string;

  @Field()
  isActive!: boolean;

  @Field()
  noMatchBehavior!: string;

  @Field(() => Int)
  maxContextChunks!: number;

  @Field(() => Float)
  temperature!: number;

  @Field(() => Int)
  documentCount!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class CreateBotInputType {
  @Field()
  name!: string;

  @Field()
  systemPrompt!: string;

  @Field(() => String, { nullable: true })
  noMatchBehavior?: string;

  @Field(() => Int, { nullable: true })
  maxContextChunks?: number;

  @Field(() => Float, { nullable: true })
  temperature?: number;
}

@InputType()
export class UpdateBotInputType {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  systemPrompt?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  noMatchBehavior?: string;

  @Field(() => Int, { nullable: true })
  maxContextChunks?: number;

  @Field(() => Float, { nullable: true })
  temperature?: number;
}
