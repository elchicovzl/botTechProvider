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

  // Persistent DOM refs — survive re-renders
  private fabEl: HTMLButtonElement | null = null;
  private panelEl: HTMLDivElement | null = null;
  private messagesEl: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private sendBtnEl: HTMLButtonElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private typingEl: HTMLDivElement | null = null;

  constructor(config: WidgetConfig) {
    this.config = config;
    this.api = new ApiClient(config.api);
    this.visitorId = this.getOrCreateVisitorId();

    this.root = document.createElement('div');
    this.root.id = 'arc-webchat-root';
    document.body.appendChild(this.root);
    this.shadow = this.root.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = getStyles(config.theme || '#2563eb', config.position || 'right');
    this.shadow.appendChild(style);

    this.buildDOM();
  }

  private getOrCreateVisitorId(): string {
    try {
      const existing = localStorage.getItem(VISITOR_ID_KEY);
      if (existing) return existing;
      const id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') return;

    this.setState(this.session ? 'RECONNECTING' : 'CONNECTING');

    try {
      const session = await this.api.createSession(this.config.tenant, this.visitorId);
      this.session = session;
      this.reconnectAttempts = 0;

      const { messages } = await this.api.getMessages(session.sessionToken);
      this.messages = messages;

      this.closeSSE?.();
      this.closeSSE = this.api.openEventStream(
        session.sessionToken,
        (msg) => this.onSSEMessage(msg),
        () => this.onSSEError(),
      );

      this.setState('CONNECTED');
      this.renderMessages();
      this.scrollToBottom();
    } catch (err) {
      console.error('[ArcWebChat] Connection failed:', err);
      this.setState('ERROR');
    }
  }

  private onSSEMessage(msg: Message): void {
    if (this.messages.some((m) => m.id === msg.id)) return;

    if (msg.direction === 'INBOUND') {
      const tempIdx = this.messages.findIndex(
        (m) => m.id.startsWith('temp-') && m.content === msg.content,
      );
      if (tempIdx !== -1) {
        this.messages[tempIdx] = msg;
        return; // No visual change needed — content is the same
      }
    }

    this.messages.push(msg);
    if (msg.direction === 'OUTBOUND') {
      this.isTyping = false;
    }

    if (this.messages.length > 200) {
      this.messages = this.messages.slice(-100);
      this.renderMessages(); // Full rebuild needed after trim
    } else {
      this.appendMessageEl(msg);
    }
    this.updateTyping();
    this.scrollToBottom();
  }

  private onSSEError(): void {
    if (this.reconnectAttempts >= 3) {
      this.setState('ERROR');
      return;
    }
    this.reconnectAttempts++;
    this.setState('RECONNECTING');
    const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
    setTimeout(() => this.connect(), delay);
  }

  private async sendMessage(content: string): Promise<void> {
    if (!this.session || !content.trim()) return;

    const trimmed = content.trim();

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content: trimmed,
      direction: 'INBOUND',
      createdAt: new Date().toISOString(),
    };
    this.messages.push(tempMsg);
    this.isTyping = true;

    // Append only the new message — no full re-render
    this.appendMessageEl(tempMsg);
    this.updateTyping();
    this.scrollToBottom();

    // Clear input
    if (this.inputEl) this.inputEl.value = '';

    try {
      await this.api.sendMessage(this.session.sessionToken, trimmed);
    } catch (err) {
      console.error('[ArcWebChat] Send failed:', err);
      this.messages = this.messages.filter((m) => m.id !== tempMsg.id);
      this.isTyping = false;
      this.renderMessages();
      this.updateTyping();
    }
  }

  // ── State ───────────────────────────────────────────────────────────────────

  private setState(state: WidgetState): void {
    this.state = state;
    this.updateStatus();
    this.updateInputState();
  }

  private toggleOpen(): void {
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') return;

    this.isOpen = !this.isOpen;

    if (this.isOpen && !this.session) {
      this.connect();
    }

    this.updateFab();
    this.updatePanelVisibility();

    if (this.isOpen) {
      setTimeout(() => {
        this.scrollToBottom();
        this.inputEl?.focus();
      }, 50);
    }
  }

  private scrollToBottom(): void {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  // ── DOM Construction (once) ─────────────────────────────────────────────────

  private buildDOM(): void {
    // FAB
    this.fabEl = document.createElement('button');
    this.fabEl.className = 'arc-fab';
    this.fabEl.onclick = () => this.toggleOpen();
    this.shadow.appendChild(this.fabEl);
    this.updateFab();

    // Panel
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'arc-panel';
    this.panelEl.style.display = 'none';

    // Header
    const header = document.createElement('div');
    header.className = 'arc-header';
    header.innerHTML = '<h3>Chat</h3>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'arc-close';
    closeBtn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    closeBtn.onclick = () => this.toggleOpen();
    header.appendChild(closeBtn);
    this.panelEl.appendChild(header);

    // Status bar
    this.statusEl = document.createElement('div');
    this.statusEl.style.display = 'none';
    this.panelEl.appendChild(this.statusEl);

    // Messages container
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'arc-messages';
    this.panelEl.appendChild(this.messagesEl);

    // Typing indicator (always in DOM, hidden by default)
    this.typingEl = document.createElement('div');
    this.typingEl.className = 'arc-typing';
    this.typingEl.innerHTML =
      '<span class="arc-typing-dot"></span><span class="arc-typing-dot"></span><span class="arc-typing-dot"></span>';
    this.typingEl.style.display = 'none';
    this.messagesEl.appendChild(this.typingEl);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'arc-input-area';

    this.inputEl = document.createElement('input');
    this.inputEl.className = 'arc-input';
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Type a message...';
    this.inputEl.disabled = true;

    this.sendBtnEl = document.createElement('button');
    this.sendBtnEl.className = 'arc-send';
    this.sendBtnEl.disabled = true;
    this.sendBtnEl.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

    const handleSend = () => {
      const val = this.inputEl?.value;
      if (!val?.trim()) return;
      this.sendMessage(val);
    };

    this.sendBtnEl.onclick = handleSend;
    this.inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') handleSend();
    };

    inputArea.appendChild(this.inputEl);
    inputArea.appendChild(this.sendBtnEl);
    this.panelEl.appendChild(inputArea);

    this.shadow.appendChild(this.panelEl);
  }

  // ── Incremental Updates ─────────────────────────────────────────────────────

  private updateFab(): void {
    if (!this.fabEl) return;
    this.fabEl.innerHTML = this.isOpen
      ? '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  }

  private updatePanelVisibility(): void {
    if (this.panelEl) {
      this.panelEl.style.display = this.isOpen ? 'flex' : 'none';
    }
  }

  private updateStatus(): void {
    if (!this.statusEl) return;
    if (this.state === 'CONNECTING' || this.state === 'RECONNECTING') {
      this.statusEl.className = 'arc-connecting';
      this.statusEl.textContent = this.state === 'CONNECTING' ? 'Connecting...' : 'Reconnecting...';
      this.statusEl.style.display = 'block';
    } else if (this.state === 'ERROR') {
      this.statusEl.className = 'arc-error';
      this.statusEl.textContent = 'Connection lost. Please refresh.';
      this.statusEl.style.display = 'block';
    } else {
      this.statusEl.style.display = 'none';
    }
  }

  private updateInputState(): void {
    const enabled = this.state === 'CONNECTED';
    if (this.inputEl) this.inputEl.disabled = !enabled;
    if (this.sendBtnEl) this.sendBtnEl.disabled = !enabled;
  }

  private updateTyping(): void {
    if (this.typingEl) {
      this.typingEl.style.display = this.isTyping ? 'flex' : 'none';
    }
    this.scrollToBottom();
  }

  /** Append a single message element — no full re-render */
  private appendMessageEl(msg: Message): void {
    if (!this.messagesEl) return;

    // Remove empty state if present
    const empty = this.messagesEl.querySelector('.arc-empty');
    if (empty) empty.remove();

    const el = document.createElement('div');
    const cssClass = msg.direction === 'INBOUND' ? 'arc-msg-visitor' : 'arc-msg-bot';
    el.className = `arc-msg ${cssClass}`;
    el.textContent = msg.content;

    // Insert before the typing indicator (which is always last child)
    this.messagesEl.insertBefore(el, this.typingEl);
  }

  /** Full message rebuild — only used on connect or after trim */
  private renderMessages(): void {
    if (!this.messagesEl) return;

    // Remove all message elements but keep the typing indicator
    const children = Array.from(this.messagesEl.children);
    for (const child of children) {
      if (child !== this.typingEl) {
        child.remove();
      }
    }

    if (this.messages.length === 0 && this.state === 'CONNECTED') {
      const empty = document.createElement('div');
      empty.className = 'arc-empty';
      empty.textContent = this.config.greeting || 'Hi! How can we help you?';
      this.messagesEl.insertBefore(empty, this.typingEl);
    } else {
      for (const msg of this.messages) {
        this.appendMessageEl(msg);
      }
    }
  }

  destroy(): void {
    this.closeSSE?.();
    this.root.remove();
  }
}
