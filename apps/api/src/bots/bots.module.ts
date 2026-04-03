import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotsService } from './bots.service';
import { BotsResolver } from './bots.resolver';
import { BotEngineService } from './bot-engine.service';
import { RagModule } from '../rag';
import { WhatsAppModule } from '../whatsapp';

@Module({
  imports: [ConfigModule, RagModule, forwardRef(() => WhatsAppModule)],
  providers: [BotsService, BotsResolver, BotEngineService],
  exports: [BotsService, BotEngineService],
})
export class BotsModule {}
