export interface MessageSender {
  queueMessage(
    tenantId: string,
    conversationId: string,
    content: string,
  ): Promise<{ messageId: string }>;
}
