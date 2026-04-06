export interface WidgetConfig {
  apiKey: string;   // widget API key (wk_...)
  api: string;      // API base URL (inferred from script src)
  theme?: string;   // primary color (hex)
  position?: 'left' | 'right';
  greeting?: string;
}

export interface Message {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  createdAt: string;
}

export type WidgetState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface Session {
  sessionToken: string;
  conversationId: string;
}
