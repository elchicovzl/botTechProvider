import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotsModule } from '../bots';
import { WebChatController } from './webchat.controller';
import { WidgetController } from './widget.controller';
import { WebChatService } from './webchat.service';
import { WebChatSenderService } from './webchat-sender.service';
import { WebChatCorsMiddleware } from './webchat-cors.middleware';
import { WebChatCronService } from './webchat-cron.service';
import { InMemorySessionStoreService } from './in-memory-session-store.service';
import { SESSION_STORE } from './session-store.interface';

@Module({
  imports: [ConfigModule, BotsModule],
  controllers: [WebChatController, WidgetController],
  providers: [
    WebChatService,
    WebChatSenderService,
    WebChatCronService,
    { provide: SESSION_STORE, useClass: InMemorySessionStoreService },
  ],
  exports: [WebChatSenderService],
})
export class WebChatModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WebChatCorsMiddleware).forRoutes('api/webchat');
  }
}
