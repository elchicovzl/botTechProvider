import { Module, forwardRef } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { QueueModule } from '../queue';
import { PrismaModule } from '../prisma';
import { WhatsAppConfigService } from './whatsapp-config.service';
import { WebhookProcessProcessor, MessageSendProcessor } from './processors';
import { EmbeddedSignupService } from './embedded-signup.service';
import { EmbeddedSignupResolver } from './embedded-signup.resolver';
import { TenantsModule } from '../tenants';
import { WhatsAppSenderService } from './whatsapp-sender.service';
import { BotsModule } from '../bots';

@Module({
  imports: [QueueModule, PrismaModule, TenantsModule, forwardRef(() => BotsModule)],
  controllers: [WebhookController],
  providers: [
    WhatsAppConfigService,
    WhatsAppSenderService,
    WebhookProcessProcessor,
    MessageSendProcessor,
    EmbeddedSignupService,
    EmbeddedSignupResolver,
  ],
  exports: [WhatsAppConfigService, WhatsAppSenderService],
})
export class WhatsAppModule {}
