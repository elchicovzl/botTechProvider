import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { EmbeddingService } from './embedding.service';

export interface RetrievedChunk {
  id: string;
  content: string;
  tokenCount: number;
  similarity: number;
  metadata: Record<string, unknown> | null;
  documentId: string;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Find the most similar document chunks to a query.
   *
   * Uses pgvector cosine distance (<=> operator) with HNSW index.
   * CRITICAL: Always filters by tenant_id + bot_id since raw SQL
   * bypasses Prisma's tenant isolation middleware.
   */
  async findSimilarChunks(
    tenantId: string,
    botId: string,
    query: string,
    topK = 5,
  ): Promise<RetrievedChunk[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.embed(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Raw SQL for cosine similarity search
    // 1 - (a <=> b) gives cosine similarity (1 = identical, 0 = orthogonal)
    const chunks = await this.prisma.$queryRaw`
      SELECT
        id,
        content,
        token_count as "tokenCount",
        document_id as "documentId",
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM document_chunks
      WHERE tenant_id = ${tenantId}
        AND bot_id = ${botId}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    ` as RetrievedChunk[];

    this.logger.debug(
      `Retrieved ${chunks.length} chunks for query (top similarity: ${
        chunks[0]?.similarity?.toFixed(3) ?? 'N/A'
      })`,
    );

    return chunks;
  }

  /**
   * Build a context string from retrieved chunks.
   * Caps total tokens at maxTokens to control LLM cost.
   */
  buildContext(
    chunks: RetrievedChunk[],
    maxTokens = 4096,
  ): string {
    const contextParts: string[] = [];
    let totalTokens = 0;

    for (const chunk of chunks) {
      if (totalTokens + chunk.tokenCount > maxTokens) break;
      contextParts.push(chunk.content);
      totalTokens += chunk.tokenCount;
    }

    if (contextParts.length === 0) {
      return '';
    }

    return contextParts.join('\n---\n');
  }
}
