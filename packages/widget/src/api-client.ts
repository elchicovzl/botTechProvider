import { Message, Session } from './types';

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async createSession(tenantSlug: string, visitorId: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/api/webchat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, visitorId }),
    });
    if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
    return res.json();
  }

  async sendMessage(sessionToken: string, content: string): Promise<{ messageId: string }> {
    const res = await fetch(`${this.baseUrl}/api/webchat/sessions/${sessionToken}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error('RATE_LIMITED');
      throw new Error(`Send failed: ${res.status}`);
    }
    return res.json();
  }

  async getMessages(
    sessionToken: string,
    limit = 50,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const res = await fetch(
      `${this.baseUrl}/api/webchat/sessions/${sessionToken}/messages?limit=${limit}`,
    );
    if (!res.ok) throw new Error(`Fetch messages failed: ${res.status}`);
    return res.json();
  }

  openEventStream(
    sessionToken: string,
    onMessage: (msg: Message) => void,
    onError: () => void,
  ): () => void {
    const es = new EventSource(
      `${this.baseUrl}/api/webchat/sessions/${sessionToken}/events`,
    );

    es.onmessage = (event) => {
      if (!event.data || event.data === '') return; // keep-alive
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'message' && parsed.message) {
          onMessage(parsed.message);
        }
      } catch {}
    };

    es.onerror = () => onError();

    return () => es.close();
  }
}
