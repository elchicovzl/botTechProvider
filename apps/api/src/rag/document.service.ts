import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma';
import { StorageService } from '../storage';
import { QUEUES, JOB_OPTIONS } from '../queue';

export interface DocumentIngestJobData {
  tenantId: string;
  botId: string;
  documentId: string;
  s3Key: string;
  mimeType: string;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(QUEUES.DOCUMENT_INGEST)
    private readonly ingestQueue: Queue<DocumentIngestJobData>,
  ) {}

  async createUploadUrl(
    tenantId: string,
    botId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<{ document: { id: string; filename: string; mimeType: string; sizeBytes: number; status: string; error: string | null; chunkCount: number | null; createdAt: Date }; uploadUrl: string }> {
    const document = await this.prisma.db.document.create({
      data: {
        tenantId,
        botId,
        filename,
        mimeType,
        sizeBytes,
        s3Key: '', // will be updated once the real key is known
        status: 'UPLOADING',
      },
    });

    const s3Key = this.storage.buildDocumentKey(
      tenantId,
      botId,
      document.id,
      filename,
    );

    await this.prisma.db.document.update({
      where: { id: document.id },
      data: { s3Key },
    });

    const uploadUrl = await this.storage.getUploadUrl(s3Key, mimeType);

    this.logger.debug(
      `Created document ${document.id} for bot ${botId} — presigned URL generated`,
    );

    return {
      document: {
        id: document.id,
        filename: document.filename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        error: document.error,
        chunkCount: document.chunkCount,
        createdAt: document.createdAt,
      },
      uploadUrl,
    };
  }

  async confirmUpload(tenantId: string, documentId: string): Promise<{ id: string; filename: string; mimeType: string; sizeBytes: number; status: string; error: string | null; chunkCount: number | null; createdAt: Date }> {
    const document = await this.prisma.db.document.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.db.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    await this.ingestQueue.add(
      'ingest',
      {
        tenantId,
        botId: document.botId,
        documentId,
        s3Key: document.s3Key,
        mimeType: document.mimeType,
      },
      JOB_OPTIONS[QUEUES.DOCUMENT_INGEST],
    );

    this.logger.debug(`Document ${documentId} confirmed — ingest job queued`);

    return {
      id: updated.id,
      filename: updated.filename,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
      status: updated.status,
      error: updated.error,
      chunkCount: updated.chunkCount,
      createdAt: updated.createdAt,
    };
  }

  async deleteDocument(tenantId: string, documentId: string): Promise<{ id: string; filename: string; mimeType: string; sizeBytes: number; status: string; error: string | null; chunkCount: number | null; createdAt: Date }> {
    const document = await this.prisma.db.document.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete chunks first (raw — vector type)
    await this.prisma.$executeRaw`
      DELETE FROM document_chunks WHERE document_id = ${documentId}
    `;

    // Delete from S3
    if (document.s3Key) {
      try {
        await this.storage.delete(document.s3Key);
      } catch (err) {
        this.logger.warn(`Failed to delete S3 object ${document.s3Key}: ${err}`);
      }
    }

    // Delete document record
    await this.prisma.db.document.delete({ where: { id: documentId } });

    this.logger.debug(`Document ${documentId} deleted`);

    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      error: document.error,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt,
    };
  }

  async findAllByBot(tenantId: string, botId: string) {
    return this.prisma.db.document.findMany({
      where: { tenantId, botId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
