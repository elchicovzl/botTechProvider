import { Module, forwardRef } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsResolver } from './conversations.resolver';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { PubSubModule } from '../common/pubsub';

@Module({
  imports: [forwardRef(() => WhatsAppModule), PubSubModule],
  providers: [ConversationsService, ConversationsResolver],
  exports: [ConversationsService],
})
export class ConversationsModule {}
