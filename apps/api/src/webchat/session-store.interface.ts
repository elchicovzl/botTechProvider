export interface SessionStore {
  set(sessionToken: string, data: { conversationId: string; tenantId: string }): void;
  get(sessionToken: string): { conversationId: string; tenantId: string } | null;
  delete(sessionToken: string): void;
  deleteByConversationId(conversationId: string): void;
}

export const SESSION_STORE = 'SESSION_STORE';
