import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotsService } from './bots.service';
import { BotsResolver } from './bots.resolver';
import { BotEngineService } from './bot-engine.service';
import { RagModule } from '../rag';

@Module({
  imports: [ConfigModule, RagModule],
  providers: [BotsService, BotsResolver, BotEngineService],
  exports: [BotsService, BotEngineService],
})
export class BotsModule {}
