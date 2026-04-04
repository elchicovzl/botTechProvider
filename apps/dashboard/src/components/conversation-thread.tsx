'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  MESSAGES_QUERY,
  UPDATE_CONVERSATION_STATUS_MUTATION,
  SEND_MESSAGE_MUTATION,
} from '@/graphql/conversations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { CheckCheck, Check, Clock, AlertCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MessageNode {
  id: string;
  waMessageId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string;
  mediaUrl: string | null;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedReason: string | null;
  createdAt: string;
}

interface MessagesData {
  messages: {
    edges: { node: MessageNode; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface UpdateStatusData {
  updateConversationStatus: {
    id: string;
    status: string;
    isSessionOpen: boolean;
  };
}

interface SendMessageData {
  sendMessage: {
    id: string;
    direction: string;
    type: string;
    content: string;
    status: string;
    createdAt: string;
  };
}

interface ConversationThreadProps {
  conversationId: string;
  contactName: string | null;
  contactPhone: string;
  status: string;
  isSessionOpen: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'READ') return <CheckCheck className="h-3 w-3 text-blue-400" />;
  if (status === 'DELIVERED') return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === 'SENT') return <Check className="h-3 w-3 text-muted-foreground" />;
  if (status === 'FAILED') return <AlertCircle className="h-3 w-3 text-destructive" />;
  return <Clock className="h-3 w-3 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'OPEN' && 'bg-blue-100 text-blue-700',
        status === 'BOT' && 'bg-green-100 text-green-700',
        status === 'RESOLVED' && 'bg-gray-100 text-gray-600',
      )}
    >
      {status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationThread({
  conversationId,
  contactName,
  contactPhone,
  status,
  isSessionOpen,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageInput, setMessageInput] = useState('');
  const { toast } = useToast();

  const { data, loading, refetch } = useQuery<MessagesData>(MESSAGES_QUERY, {
    variables: { conversationId, first: 50 },
    fetchPolicy: 'cache-and-network',
    pollInterval: 3000, // Poll every 3 seconds for new messages
  });

  const [updateStatus, { loading: updating }] = useMutation<UpdateStatusData>(
    UPDATE_CONVERSATION_STATUS_MUTATION,
    {
      refetchQueries: ['Conversations'],
      onCompleted: () => toast('Status updated', 'success'),
    },
  );

  const [sendMessage, { loading: sendLoading }] = useMutation<SendMessageData>(
    SEND_MESSAGE_MUTATION,
  );

  const messages = [...(data?.messages?.edges ?? [])].reverse();

  // Scroll to bottom whenever messages load/update
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleStatusChange = (newStatus: string) => {
    updateStatus({ variables: { conversationId, status: newStatus } });
  };

  const handleSend = async () => {
    const trimmed = messageInput.trim();
    if (!trimmed || sendLoading) return;
    await sendMessage({ variables: { conversationId, content: trimmed } });
    setMessageInput('');
    refetch();
    toast('Message sent', 'success');
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="font-semibold">{contactName || contactPhone}</p>
          {contactName && (
            <p className="text-xs text-muted-foreground">{contactPhone}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={status} />

          {status === 'BOT' && (
            <Button
              size="sm"
              variant="outline"
              disabled={updating}
              onClick={() => handleStatusChange('OPEN')}
            >
              Take Over
            </Button>
          )}

          {status === 'OPEN' && (
            <Button
              size="sm"
              variant="outline"
              disabled={updating}
              onClick={() => handleStatusChange('BOT')}
            >
              Assign to Bot
            </Button>
          )}

          {status !== 'RESOLVED' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={updating}
              onClick={() => handleStatusChange('RESOLVED')}
            >
              Resolve
            </Button>
          )}

          {status === 'RESOLVED' && (
            <Button
              size="sm"
              variant="outline"
              disabled={updating}
              onClick={() => handleStatusChange('OPEN')}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Loading messages…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No messages yet
          </div>
        )}

        {messages.map(({ node: msg }) => {
          const isInbound = msg.direction === 'INBOUND';
          return (
            <div
              key={msg.id}
              className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}
            >
              <div
                className={cn(
                  'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
                  isInbound
                    ? 'rounded-tl-sm bg-muted text-foreground'
                    : 'rounded-tr-sm bg-primary text-primary-foreground',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <div
                  className={cn(
                    'mt-1 flex items-center gap-1 text-[10px]',
                    isInbound ? 'justify-start text-muted-foreground' : 'justify-end text-primary-foreground/70',
                  )}
                >
                  <span>{formatTime(msg.sentAt ?? msg.createdAt)}</span>
                  {!isInbound && <StatusIcon status={msg.status} />}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Footer ── */}
      {isSessionOpen ? (
        <div className="border-t p-4 flex gap-2">
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            onClick={handleSend}
            disabled={sendLoading || !messageInput.trim()}
          >
            Send
          </Button>
        </div>
      ) : (
        <div className="border-t px-4 py-3">
          <p className="text-center text-xs text-muted-foreground">
            Session expired — only template messages allowed
          </p>
        </div>
      )}
    </div>
  );
}
