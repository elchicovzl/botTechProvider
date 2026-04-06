import { Message, Session } from './types';

/**
 * Iframe-based API client. All network calls happen inside a hidden iframe
 * served from the API's own domain, avoiding Chrome extension interception
 * of window.fetch / XMLHttpRequest on the host page.
 *
 * This is the same approach used by Intercom, Crisp, and Drift.
 */
export class ApiClient {
  private baseUrl: string;
  private iframe: HTMLIFrameElement | null = null;
  private proxyReady = false;
  private readyPromise: Promise<void>;
  private pendingRequests = new Map<string, {
    resolve: (val: any) => void;
    reject: (err: Error) => void;
  }>();
  private sseHandlers = new Map<string, {
    onMessage: (msg: Message) => void;
    onError: () => void;
  }>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.readyPromise = this.initProxy();
  }

  private initProxy(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.iframe = document.createElement('iframe');
      this.iframe.src = `${this.baseUrl}/widget/v1/proxy.html`;
      this.iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
      this.iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.iframe);

      // Timeout if proxy doesn't respond in 10s
      const timeout = setTimeout(() => {
        if (!this.proxyReady) {
          console.error('[ArcWebChat] Proxy iframe did not respond in time');
          reject(new Error('Proxy timeout'));
        }
      }, 10000);

      window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || !data.__arcProxy) return;

        if (data.type === 'PROXY_READY') {
          this.proxyReady = true;
          clearTimeout(timeout);
          resolve();
          return;
        }

        if (data.type === 'FETCH_RESPONSE') {
          const pending = this.pendingRequests.get(data.id);
          if (pending) {
            this.pendingRequests.delete(data.id);
            if (data.error) {
              pending.reject(new Error(data.error));
            } else {
              pending.resolve({ status: data.status, data: data.body });
            }
          }
          return;
        }

        if (data.type === 'SSE_EVENT') {
          const handler = this.sseHandlers.get(data.id);
          if (handler) handler.onMessage(data.message);
          return;
        }

        if (data.type === 'SSE_ERROR') {
          const handler = this.sseHandlers.get(data.id);
          if (handler) handler.onError();
          return;
        }
      });
    });
  }

  private async proxyFetch(
    method: string,
    url: string,
    body?: string,
  ): Promise<{ status: number; data: string }> {
    await this.readyPromise;

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, { resolve, reject });

      this.iframe!.contentWindow!.postMessage(
        { __arcProxy: true, type: 'FETCH', id, method, url, body },
        '*',
      );

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 15000);
    });
  }

  async createSession(apiKey: string, visitorId: string): Promise<Session> {
    const { status, data } = await this.proxyFetch(
      'POST',
      `${this.baseUrl}/api/webchat/sessions`,
      JSON.stringify({ apiKey, visitorId, origin: window.location.origin }),
    );
    if (status === 401) throw new Error('INVALID_API_KEY');
    if (status >= 400) throw new Error(`Session creation failed: ${status}`);
    return JSON.parse(data) as Session;
  }

  async sendMessage(sessionToken: string, content: string): Promise<{ messageId: string }> {
    const { status, data } = await this.proxyFetch(
      'POST',
      `${this.baseUrl}/api/webchat/sessions/${sessionToken}/messages`,
      JSON.stringify({ content }),
    );
    if (status === 429) throw new Error('RATE_LIMITED');
    if (status >= 400) throw new Error(`Send failed: ${status}`);
    return JSON.parse(data) as { messageId: string };
  }

  async getMessages(
    sessionToken: string,
    limit = 50,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const { status, data } = await this.proxyFetch(
      'GET',
      `${this.baseUrl}/api/webchat/sessions/${sessionToken}/messages?limit=${limit}`,
    );
    if (status >= 400) throw new Error(`Fetch messages failed: ${status}`);
    return JSON.parse(data) as { messages: Message[]; hasMore: boolean };
  }

  openEventStream(
    sessionToken: string,
    onMessage: (msg: Message) => void,
    onError: () => void,
  ): () => void {
    const id = crypto.randomUUID();
    this.sseHandlers.set(id, { onMessage, onError });

    this.readyPromise.then(() => {
      this.iframe!.contentWindow!.postMessage(
        {
          __arcProxy: true,
          type: 'SSE_CONNECT',
          id,
          url: `${this.baseUrl}/api/webchat/sessions/${sessionToken}/events`,
        },
        '*',
      );
    });

    return () => {
      this.sseHandlers.delete(id);
      this.iframe?.contentWindow?.postMessage(
        { __arcProxy: true, type: 'SSE_DISCONNECT', id },
        '*',
      );
    };
  }

  destroy(): void {
    this.iframe?.remove();
    this.pendingRequests.clear();
    this.sseHandlers.clear();
  }
}
