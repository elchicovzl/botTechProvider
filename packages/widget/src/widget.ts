import { WidgetConfig, WidgetState, Message, Session } from './types';
import { ApiClient } from './api-client';
import { getStyles } from './styles';

const VISITOR_ID_KEY = 'arc-webchat-visitor-id';

export class Widget {
  private config: WidgetConfig;
  private api: ApiClient;
  private state: WidgetState = 'IDLE';
  private session: Session | null = null;
  private messages: Message[] = [];
  private isOpen = false;
  private isTyping = false;
  private visitorId: string;
  private closeSSE: (() => void) | null = null;
  private reconnectAttempts = 0;
  private shadow: ShadowRoot;
  private root: HTMLDivElement;

  constructor(config: WidgetConfig) {
    this.config = config;
    this.api = new ApiClient(config.api);
    this.visitorId = this.getOrCreateVisitorId();

    // Create shadow DOM container
    this.root = document.createElement('div');
    this.root.id = 'arc-webchat-root';
    document.body.appendChild(this.root);
    this.shadow = this.root.attachShadow({ mode: 'closed' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = getStyles(config.theme || '#2563eb', config.position || 'right');
    this.shadow.appendChild(style);

    this.render();
  }

  private getOrCreateVisitorId(): string {
    try {
      const existing = localStorage.getItem(VISITOR_ID_KEY);
      if (existing) return existing;
      const id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    } catch {
      // Private browsing or localStorage blocked
      return crypto.randomUUID();
    }
  }

  private async connect(): Promise<void> {
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') return;

    this.setState(this.session ? 'RECONNECTING' : 'CONNECTING');

    try {
      const session = await this.api.createSession(this.config.tenant, this.visitorId);
      this.session = session;
      this.reconnectAttempts = 0;

      // Load message history; API returns DESC (newest first), reverse to ASC for display
      const { messages } = await this.api.getMessages(session.sessionToken);
      this.messages = messages.reverse();
      this.render();

      // Open SSE
      this.closeSSE?.();
      this.closeSSE = this.api.openEventStream(
        session.sessionToken,
        (msg) => this.onSSEMessage(msg),
        () => this.onSSEError(),
      );

      this.setState('CONNECTED');
    } catch (err) {
      console.error('[ArcWebChat] Connection failed:', err);
      this.setState('ERROR');
    }
  }

  private onSSEMessage(msg: Message): void {
    // Deduplicate
    if (this.messages.some((m) => m.id === msg.id)) return;

    this.messages.push(msg);
    this.isTyping = false;

    // Keep max 200 messages in memory
    if (this.messages.length > 200) {
      this.messages = this.messages.slice(-100);
    }

    this.render();
    this.scrollToBottom();
  }

  private onSSEError(): void {
    if (this.reconnectAttempts >= 3) {
      this.setState('ERROR');
      return;
    }

    this.reconnectAttempts++;
    this.setState('RECONNECTING');
    const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000; // 1s, 2s, 4s
    setTimeout(() => this.connect(), delay);
  }

  private async sendMessage(content: string): Promise<void> {
    if (!this.session || !content.trim()) return;

    const trimmed = content.trim();

    // Optimistic UI — visitor messages are INBOUND from API perspective
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content: trimmed,
      direction: 'INBOUND',
      createdAt: new Date().toISOString(),
    };
    this.messages.push(tempMsg);
    this.isTyping = true;
    this.render();
    this.scrollToBottom();

    try {
      await this.api.sendMessage(this.session.sessionToken, trimmed);
    } catch (err) {
      console.error('[ArcWebChat] Send failed:', err);
      // Remove temp message on failure
      this.messages = this.messages.filter((m) => m.id !== tempMsg.id);
      this.isTyping = false;
      this.render();
    }
  }

  private setState(state: WidgetState): void {
    this.state = state;
    this.render();
  }

  private toggleOpen(): void {
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') return;

    this.isOpen = !this.isOpen;

    if (this.isOpen && !this.session) {
      this.connect();
    }

    this.render();
    if (this.isOpen) {
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  private scrollToBottom(): void {
    const container = this.shadow.querySelector('.arc-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }

  private render(): void {
    // Keep the style element, remove everything else
    const style = this.shadow.querySelector('style');
    while (this.shadow.lastChild && this.shadow.lastChild !== style) {
      this.shadow.removeChild(this.shadow.lastChild);
    }

    // FAB button
    const fab = document.createElement('button');
    fab.className = 'arc-fab';
    fab.innerHTML = this.isOpen
      ? '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    fab.onclick = () => this.toggleOpen();
    this.shadow.appendChild(fab);

    // Chat panel (only when open)
    if (!this.isOpen) return;

    const panel = document.createElement('div');
    panel.className = 'arc-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'arc-header';
    header.innerHTML = `<h3>Chat</h3>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'arc-close';
    closeBtn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    closeBtn.onclick = () => this.toggleOpen();
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Status bar
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') {
      const status = document.createElement('div');
      status.className = 'arc-connecting';
      status.textContent = this.state === 'CONNECTING' ? 'Connecting...' : 'Reconnecting...';
      panel.appendChild(status);
    } else if (this.state === 'ERROR') {
      const error = document.createElement('div');
      error.className = 'arc-error';
      error.textContent = 'Connection lost. Please refresh.';
      panel.appendChild(error);
    }

    // Messages
    const messagesDiv = document.createElement('div');
    messagesDiv.className = 'arc-messages';

    if (this.messages.length === 0 && this.state === 'CONNECTED') {
      const empty = document.createElement('div');
      empty.className = 'arc-empty';
      empty.textContent = this.config.greeting || 'Hi! How can we help you?';
      messagesDiv.appendChild(empty);
    } else {
      for (const msg of this.messages) {
        const el = document.createElement('div');
        // Direction mapping:
        //   INBOUND  = visitor sent it → right-aligned (arc-msg-visitor)
        //   OUTBOUND = bot/agent reply → left-aligned  (arc-msg-bot)
        const cssClass = msg.direction === 'INBOUND' ? 'arc-msg-visitor' : 'arc-msg-bot';
        el.className = `arc-msg ${cssClass}`;
        el.textContent = msg.content;
        messagesDiv.appendChild(el);
      }
    }

    // Typing indicator
    if (this.isTyping) {
      const typing = document.createElement('div');
      typing.className = 'arc-typing';
      typing.innerHTML =
        '<span class="arc-typing-dot"></span><span class="arc-typing-dot"></span><span class="arc-typing-dot"></span>';
      messagesDiv.appendChild(typing);
    }

    panel.appendChild(messagesDiv);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'arc-input-area';

    const input = document.createElement('input');
    input.className = 'arc-input';
    input.type = 'text';
    input.placeholder = 'Type a message...';
    input.disabled = this.state !== 'CONNECTED';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'arc-send';
    sendBtn.disabled = this.state !== 'CONNECTED';
    sendBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

    const handleSend = () => {
      const val = input.value;
      if (!val.trim()) return;
      input.value = '';
      this.sendMessage(val);
    };

    sendBtn.onclick = handleSend;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleSend();
    };

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    panel.appendChild(inputArea);

    this.shadow.appendChild(panel);

    // Focus input when connected
    if (this.state === 'CONNECTED') {
      setTimeout(() => input.focus(), 50);
    }
  }

  destroy(): void {
    this.closeSSE?.();
    this.root.remove();
  }
}
