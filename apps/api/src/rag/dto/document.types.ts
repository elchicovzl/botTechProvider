import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class DocumentType {
  @Field(() => ID)
  id!: string;

  @Field()
  filename!: string;

  @Field()
  mimeType!: string;

  @Field(() => Int)
  sizeBytes!: number;

  @Field()
  status!: string;

  @Field(() => String, { nullable: true })
  error?: string | null;

  @Field(() => Int, { nullable: true })
  chunkCount?: number | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class DocumentUploadPayloadType {
  @Field(() => DocumentType)
  document!: DocumentType;

  @Field()
  uploadUrl!: string;
}
