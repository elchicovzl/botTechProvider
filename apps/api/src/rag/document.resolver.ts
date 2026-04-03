import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { DocumentService } from './document.service';
import { DocumentType, DocumentUploadPayloadType } from './dto';
import { CurrentUser, JwtPayload } from '../common/decorators';

@Resolver(() => DocumentType)
export class DocumentResolver {
  constructor(private readonly documentService: DocumentService) {}

  @Query(() => [DocumentType])
  async documents(
    @CurrentUser() user: JwtPayload,
    @Args('botId') botId: string,
  ): Promise<DocumentType[]> {
    return this.documentService.findAllByBot(
      user.tenantId,
      botId,
    ) as unknown as DocumentType[];
  }

  @Mutation(() => DocumentUploadPayloadType)
  async createDocumentUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Args('botId') botId: string,
    @Args('filename') filename: string,
    @Args('mimeType') mimeType: string,
    @Args('sizeBytes', { type: () => Int }) sizeBytes: number,
  ): Promise<DocumentUploadPayloadType> {
    const result = await this.documentService.createUploadUrl(
      user.tenantId,
      botId,
      filename,
      mimeType,
      sizeBytes,
    );

    return result as unknown as DocumentUploadPayloadType;
  }

  @Mutation(() => DocumentType)
  async confirmDocumentUpload(
    @CurrentUser() user: JwtPayload,
    @Args('documentId') documentId: string,
  ): Promise<DocumentType> {
    return this.documentService.confirmUpload(
      user.tenantId,
      documentId,
    ) as unknown as DocumentType;
  }

  @Mutation(() => DocumentType)
  async deleteDocument(
    @CurrentUser() user: JwtPayload,
    @Args('id') id: string,
  ): Promise<DocumentType> {
    return this.documentService.deleteDocument(
      user.tenantId,
      id,
    ) as unknown as DocumentType;
  }
}
