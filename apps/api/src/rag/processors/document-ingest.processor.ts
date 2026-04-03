import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { PrismaService } from '../../prisma';
import { StorageService } from '../../storage';
import { EmbeddingService } from '../embedding.service';
import { ChunkingService } from '../chunking.service';
import { QUEUES } from '../../queue';
import type { DocumentIngestJobData } from '../document.service';

@Processor(QUEUES.DOCUMENT_INGEST)
export class DocumentIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly embedding: EmbeddingService,
    private readonly chunking: ChunkingService,
  ) {
    super();
  }

  async process(job: Job<DocumentIngestJobData>): Promise<void> {
    const { tenantId, botId, documentId, s3Key, mimeType } = job.data;

    this.logger.log(`Ingesting document ${documentId} (${mimeType})`);

    try {
      // 1. Download from S3
      const buffer = await this.storage.download(s3Key);

      // 2. Parse text based on mimeType
      const text = await this.parseDocument(buffer, mimeType);

      if (!text || text.trim().length === 0) {
        throw new Error('Document produced no extractable text');
      }

      // 3. Chunk text
      const chunks = this.chunking.chunk(text);

      if (chunks.length === 0) {
        throw new Error('Chunking produced zero chunks');
      }

      // 4. Generate embeddings in batch
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embedding.embedBatch(texts);

      // 5. Store chunks + embeddings via raw SQL (Prisma doesn't support vector type)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const id = randomUUID();
        const embeddingStr = `[${embedding.join(',')}]`;
        const metadata = JSON.stringify({ chunkIndex: chunk.chunkIndex });

        await this.prisma.$executeRaw`
          INSERT INTO document_chunks (id, tenant_id, bot_id, document_id, content, token_count, chunk_index, embedding, metadata, created_at)
          VALUES (${id}, ${tenantId}, ${botId}, ${documentId}, ${chunk.content}, ${chunk.tokenCount}, ${chunk.chunkIndex}, ${embeddingStr}::vector, ${metadata}::jsonb, NOW())
        `;
      }

      // 6. Update Document to READY
      await this.prisma.db.document.update({
        where: { id: documentId },
        data: {
          status: 'READY',
          chunkCount: chunks.length,
          error: null,
        },
      });

      this.logger.log(
        `Document ${documentId} ingested — ${chunks.length} chunks stored`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.error(
        `Document ${documentId} ingest failed: ${errorMessage}`,
      );

      // 7. Set status to FAILED
      await this.prisma.db.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      });

      throw err; // Re-throw so BullMQ retries per job options
    }
  }

  private async parseDocument(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      return result.text;
    }

    if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (mimeType === 'text/plain' || mimeType.startsWith('text/')) {
      return buffer.toString('utf-8');
    }

    throw new Error(`Unsupported mimeType: ${mimeType}`);
  }
}
