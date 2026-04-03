import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { RetrievalService } from './retrieval.service';
import { DocumentService } from './document.service';
import { DocumentResolver } from './document.resolver';
import { DocumentIngestProcessor } from './processors';
import { QueueModule } from '../queue';
import { StorageModule } from '../storage';

@Module({
  imports: [QueueModule, StorageModule],
  providers: [
    EmbeddingService,
    ChunkingService,
    RetrievalService,
    DocumentService,
    DocumentResolver,
    DocumentIngestProcessor,
  ],
  exports: [EmbeddingService, ChunkingService, RetrievalService, DocumentService],
})
export class RagModule {}
