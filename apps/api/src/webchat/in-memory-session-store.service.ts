import { Injectable } from '@nestjs/common';
import { SessionStore } from './session-store.interface';

@Injectable()
export class InMemorySessionStoreService implements SessionStore {
  // NOTE: Sessions are lost on restart. Use Redis-backed store for production.
  private readonly sessions = new Map<string, { conversationId: string; tenantId: string }>();

  set(token: string, data: { conversationId: string; tenantId: string }): void {
    this.sessions.set(token, data);
  }

  get(token: string): { conversationId: string; tenantId: string } | null {
    return this.sessions.get(token) ?? null;
  }

  delete(token: string): void {
    this.sessions.delete(token);
  }

  deleteByConversationId(conversationId: string): void {
    for (const [token, data] of this.sessions.entries()) {
      if (data.conversationId === conversationId) {
        this.sessions.delete(token);
      }
    }
  }
}
