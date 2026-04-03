import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { QueueModule } from '../queue';
import { PrismaModule } from '../prisma';
import { WhatsAppConfigService } from './whatsapp-config.service';
import { WebhookProcessProcessor, MessageSendProcessor } from './processors';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { BotsModule } from '../bots';

@Module({
  imports: [ConfigModule, QueueModule, PrismaModule, forwardRef(() => BotsModule)],
  controllers: [WebhookController],
  providers: [
    WhatsAppConfigService,
    WhatsAppSenderService,
    WebhookProcessProcessor,
    MessageSendProcessor,
  ],
  exports: [WhatsAppConfigService, WhatsAppSenderService],
})
export class WhatsAppModule {}
