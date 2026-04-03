import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { RetrievalService } from '../rag';
import { WhatsAppSenderService } from '../whatsapp';

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);
  private readonly ollamaBaseUrl: string;
  private readonly chatModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly retrievalService: RetrievalService,
    @Inject(forwardRef(() => WhatsAppSenderService))
    private readonly senderService: WhatsAppSenderService,
  ) {
    this.ollamaBaseUrl = this.configService.getOrThrow('OLLAMA_BASE_URL');
    this.chatModel = this.configService.getOrThrow('OLLAMA_CHAT_MODEL');
  }

  /**
   * Process an inbound message and generate a bot reply.
   *
   * Flow:
   * 1. Load conversation + bot config
   * 2. Guard: if conversation.status !== BOT, skip
   * 3. Retrieve top-k chunks from RAG
   * 4. Build prompt (system + context + history + user message)
   * 5. Call Ollama gemma4:31b
   * 6. Queue outbound message via WhatsApp
   */
  async processMessage(
    tenantId: string,
    conversationId: string,
    inboundContent: string,
  ): Promise<void> {
    // 1. Load conversation
    const conversation = await this.prisma.db.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation || conversation.status !== 'BOT' || !conversation.botId) {
      return;
    }

    // 2. Load bot config
    const bot = await this.prisma.db.bot.findFirst({
      where: { id: conversation.botId, tenantId, isActive: true, deletedAt: null },
    });

    if (!bot) {
      this.logger.warn(`Bot ${conversation.botId} not found or inactive for tenant ${tenantId}`);
      return;
    }

    // 3. Retrieve context from RAG
    const chunks = await this.retrievalService.findSimilarChunks(
      tenantId,
      bot.id,
      inboundContent,
      bot.maxContextChunks,
    );

    const context = this.retrievalService.buildContext(chunks, 4096);

    // 4. Check if we have relevant context
    if (!context && bot.noMatchBehavior === 'DECLINE') {
      const fallbackMessage = 'No tengo información sobre eso. ¿Puedo ayudarte con algo más?';
      await this.senderService.queueMessage(tenantId, conversationId, fallbackMessage);
      return;
    }

    // 5. Build messages for LLM
    const messages = await this.buildMessages(
      bot.systemPrompt,
      context,
      conversationId,
      tenantId,
      inboundContent,
    );

    // 6. Call Ollama
    const reply = await this.callOllama(messages, bot.temperature);

    if (!reply) {
      this.logger.error('Ollama returned empty response');
      return;
    }

    // 7. Queue outbound message
    await this.senderService.queueMessage(tenantId, conversationId, reply);

    this.logger.debug(
      `Bot reply generated for conversation ${conversationId} (${reply.length} chars)`,
    );
  }

  private async buildMessages(
    systemPrompt: string,
    context: string,
    conversationId: string,
    tenantId: string,
    userMessage: string,
  ): Promise<Array<{ role: string; content: string }>> {
    // Build system message with context
    let system = systemPrompt;
    if (context) {
      system += `\n\n<context>\n${context}\n</context>`;
      system +=
        '\n\nIMPORTANT: Only answer based on the provided context. If the context does not contain relevant information, say so clearly.';
    }

    // Get recent conversation history (last 10 messages)
    const recentMessages = await this.prisma.db.message.findMany({
      where: { conversationId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Build message history (reverse to chronological order, exclude current inbound)
    const history = recentMessages
      .reverse()
      .slice(0, -1) // Exclude the current inbound message (it's the last one)
      .map((msg) => ({
        role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
        content: msg.content ?? '',
      }))
      .filter((msg) => msg.content.length > 0);

    return [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: userMessage },
    ];
  }

  private async callOllama(
    messages: Array<{ role: string; content: string }>,
    temperature: number,
  ): Promise<string | null> {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.chatModel,
          messages,
          stream: false,
          options: {
            temperature,
            num_predict: 1024,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Ollama chat error: ${error}`);
        return null;
      }

      const result = (await response.json()) as { message?: { content?: string } };
      return result.message?.content?.trim() ?? null;
    } catch (error) {
      this.logger.error(`Ollama connection failed: ${error}`);
      return null;
    }
  }
}
