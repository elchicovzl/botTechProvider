export interface WidgetConfig {
  tenant: string;     // tenant slug
  api: string;        // API base URL
  theme?: string;     // primary color (hex)
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
