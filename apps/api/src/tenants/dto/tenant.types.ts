import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class WhatsAppConfigInfoType {
  @Field()
  isActive!: boolean;

  @Field(() => String, { nullable: true })
  displayPhoneNumber?: string | null;

  @Field()
  phoneVerificationStatus!: string;

  @Field(() => Date, { nullable: true })
  connectedAt?: Date | null;
}

@ObjectType()
export class TenantType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field()
  status!: string;

  @Field(() => WhatsAppConfigInfoType, { nullable: true })
  whatsappConfig?: WhatsAppConfigInfoType | null;

  @Field()
  createdAt!: Date;
}
