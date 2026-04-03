import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly ollamaBaseUrl: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.ollamaBaseUrl = this.configService.getOrThrow('OLLAMA_BASE_URL');
    this.model = this.configService.getOrThrow('OLLAMA_EMBEDDING_MODEL');
  }

  /**
   * Generate embeddings for a single text.
   * Uses Ollama's /api/embed endpoint with nomic-embed-text.
   * Returns a 768-dimensional vector.
   */
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaBaseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embedding failed: ${error}`);
    }

    const result = await response.json() as { embeddings: number[][] };
    return result.embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * Processes in batches of 100 with 200ms delay between batches.
   */
  async embedBatch(
    texts: string[],
    batchSize = 100,
    delayMs = 200,
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Ollama /api/embed supports array input
      const response = await fetch(`${this.ollamaBaseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: batch }),
      });

      if (!response.ok) {
        throw new Error(`Ollama batch embedding failed at batch ${i / batchSize}`);
      }

      const result = await response.json() as { embeddings: number[][] };
      embeddings.push(...result.embeddings);

      // Delay between batches
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return embeddings;
  }
}
