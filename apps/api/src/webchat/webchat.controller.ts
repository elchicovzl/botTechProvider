import {
  Controller,
  Post,
  Get,
  Sse,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { Observable, type Observer } from 'rxjs';
import { Public } from '../common/decorators';
import { WebChatService } from './webchat.service';
import { WebChatThrottleGuard } from './guards/webchat-throttle.guard';

interface MessageEvent {
  data: string | object;
}

@Controller('api/webchat')
@Public()
export class WebChatController {
  constructor(private readonly webchatService: WebChatService) {}

  // ─── POST /api/webchat/sessions ──────────────────────────────────────────

  @Post('sessions')
  @HttpCode(200)
  async createSession(
    @Body() body: { apiKey: string; visitorId: string; visitorName?: string; origin?: string },
  ) {
    return this.webchatService.createSession(
      body.apiKey,
      body.visitorId,
      body.visitorName,
      body.origin,
    );
  }

  // ─── POST /api/webchat/sessions/:sessionToken/messages ───────────────────

  @Post('sessions/:sessionToken/messages')
  @HttpCode(201)
  @UseGuards(WebChatThrottleGuard)
  async sendMessage(
    @Param('sessionToken') sessionToken: string,
    @Body() body: { content: string },
  ) {
    return this.webchatService.sendMessage(sessionToken, body.content);
  }

  // ─── GET /api/webchat/sessions/:sessionToken/messages ────────────────────

  @Get('sessions/:sessionToken/messages')
  async getMessages(
    @Param('sessionToken') sessionToken: string,
    @Query('limit') limitStr?: string,
    @Query('before') before?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 100);
    return this.webchatService.getMessages(sessionToken, limit, before);
  }

  // ─── SSE /api/webchat/sessions/:sessionToken/events ──────────────────────

  @Sse('sessions/:sessionToken/events')
  events(@Param('sessionToken') sessionToken: string): Observable<MessageEvent> {
    const session = this.webchatService.verifySession(sessionToken);
    const pubSub = this.webchatService.getPubSub();

    return new Observable<MessageEvent>((subscriber: Observer<MessageEvent>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const iterator = pubSub.asyncIterableIterator('MESSAGE_ADDED') as any;
      let active = true;

      const listen = async () => {
        for await (const event of iterator) {
          if (!active) break;
          if ((event as any).conversationId === session.conversationId) {
            subscriber.next({
              data: JSON.stringify({
                type: 'message',
                message: (event as any).messageAdded,
              }),
            });
          }
        }
      };
      listen().catch((err) => subscriber.error(err));

      // Keep-alive every 30s to prevent proxy timeouts
      const keepAlive = setInterval(() => {
        subscriber.next({ data: '' } as any);
      }, 30_000);

      // Cleanup on disconnect
      return () => {
        active = false;
        clearInterval(keepAlive);
        void iterator.return?.();
      };
    });
  }
}
