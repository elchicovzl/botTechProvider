import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MessageSender } from '../interfaces/message-sender.interface';
import { WhatsAppSenderService } from '../../whatsapp/whatsapp-sender.service';
import { WebChatSenderService } from '../../webchat/webchat-sender.service';

@Injectable()
export class SenderResolverService {
  constructor(private readonly moduleRef: ModuleRef) {}

  resolve(channel: string): MessageSender {
    switch (channel) {
      case 'WHATSAPP':
        return this.moduleRef.get(WhatsAppSenderService, { strict: false });
      case 'WEB':
        return this.moduleRef.get(WebChatSenderService, { strict: false });
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }
}
