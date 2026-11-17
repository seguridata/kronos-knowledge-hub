import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  controllers: [KnowledgeController],
  providers: [EmbeddingService, KnowledgeIndexerService],
  exports: [EmbeddingService, KnowledgeIndexerService],
})
export class KnowledgeModule {}
