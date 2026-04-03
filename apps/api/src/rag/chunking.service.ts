import { Injectable } from '@nestjs/common';

export interface ChunkResult {
  content: string;
  tokenCount: number;
  chunkIndex: number;
}

@Injectable()
export class ChunkingService {
  private readonly chunkSize = 512; // target tokens per chunk
  private readonly chunkOverlap = 50; // overlap tokens
  private readonly separators = ['\n\n', '\n', '. ', ' ', ''];

  /**
   * Split text into chunks using recursive character splitting.
   * Approximates token count as chars/4 (rough estimate).
   */
  chunk(text: string): ChunkResult[] {
    const maxChars = this.chunkSize * 4; // ~4 chars per token
    const overlapChars = this.chunkOverlap * 4;

    const rawChunks = this.recursiveSplit(text, maxChars, overlapChars);

    return rawChunks.map((content, index) => ({
      content: content.trim(),
      tokenCount: Math.ceil(content.length / 4),
      chunkIndex: index,
    })).filter((c) => c.content.length > 0);
  }

  private recursiveSplit(
    text: string,
    maxChars: number,
    overlapChars: number,
  ): string[] {
    if (text.length <= maxChars) {
      return [text];
    }

    // Try each separator from most to least specific
    for (const separator of this.separators) {
      if (separator === '') {
        // Last resort: split by character count
        return this.splitBySize(text, maxChars, overlapChars);
      }

      const parts = text.split(separator);
      if (parts.length <= 1) continue;

      const chunks: string[] = [];
      let current = '';

      for (const part of parts) {
        const candidate = current ? current + separator + part : part;

        if (candidate.length > maxChars && current) {
          chunks.push(current);
          // Start new chunk with overlap
          const overlapStart = Math.max(0, current.length - overlapChars);
          current = current.slice(overlapStart) + separator + part;
        } else {
          current = candidate;
        }
      }

      if (current) {
        chunks.push(current);
      }

      if (chunks.length > 1) {
        return chunks;
      }
    }

    return this.splitBySize(text, maxChars, overlapChars);
  }

  private splitBySize(
    text: string,
    maxChars: number,
    overlapChars: number,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlapChars;
      if (start >= text.length - overlapChars) break;
    }

    return chunks;
  }
}
