'use client';

import { useState, useMemo } from 'react';
import { useQuery, useSubscription } from '@apollo/client/react';
import { CONVERSATIONS_QUERY, CONVERSATION_UPDATED_SUBSCRIPTION } from '@/graphql/conversations';
import { ME_QUERY } from '@/graphql/auth';
import { ConversationThread } from '@/components/conversation-thread';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, MessageSquare, ArrowLeft, Phone, Globe } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LastMessage {
  id: string;
  content: string;
  direction: string;
  type: string;
  createdAt: string;
}

interface ConversationNode {
  id: string;
  channel: string;
  waContactPhone: string | null;
  waContactName: string | null;
  webContactName: string | null;
  webVisitorId: string | null;
  status: string;
  isSessionOpen: boolean;
  lastInboundAt: string | null;
  lastMessage: LastMessage | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsData {
  conversations: {
    edges: { node: ConversationNode; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    totalCount: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Bot', value: 'BOT' },
  { label: 'Resolved', value: 'RESOLVED' },
] as const;

const CHANNEL_TABS = [
  { label: 'All', value: '' },
  { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'Web', value: 'WEB' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
        status === 'OPEN' && 'bg-blue-100 text-blue-700',
        status === 'BOT' && 'bg-green-100 text-green-700',
        status === 'RESOLVED' && 'bg-gray-100 text-gray-600',
      )}
    >
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [activeStatus, setActiveStatus] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: meData } = useQuery<{ me: { tenantId: string } }>(ME_QUERY);

  const { data, loading, refetch } = useQuery<ConversationsData>(CONVERSATIONS_QUERY, {
    variables: {
      first: 50,
      status: activeStatus || undefined,
      search: search || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });

  // Real-time updates via subscription
  useSubscription(CONVERSATION_UPDATED_SUBSCRIPTION, {
    variables: { tenantId: meData?.me?.tenantId ?? '' },
    skip: !meData?.me?.tenantId,
    onData: () => refetch(),
  });

  const conversations = data?.conversations?.edges ?? [];

  const filteredConversations = conversations.filter(({ node }) => {
    if (channelFilter && node.channel !== channelFilter) return false;
    return true;
  });

  // Find the selected conversation node for passing props to the thread
  const selectedConv = useMemo(
    () => filteredConversations.find(({ node }) => node.id === selectedId)?.node ?? null,
    [filteredConversations, selectedId],
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-lg border overflow-hidden bg-background">
      {/* ══ Left Panel ═══════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'w-full md:w-80 md:border-r flex-shrink-0 flex flex-col',
          selectedId ? 'hidden md:flex' : 'flex',
        )}
      >
        {/* Search */}
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex border-b">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                activeStatus === tab.value
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Channel filter tabs */}
        <div className="flex border-b bg-muted/30">
          {CHANNEL_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setChannelFilter(tab.value)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium transition-colors',
                channelFilter === tab.value
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading && filteredConversations.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No conversations</p>
              <p className="text-xs text-muted-foreground">
                {search ? 'Try a different search' : 'Connect WhatsApp to start'}
              </p>
            </div>
          ) : (
            filteredConversations.map(({ node: conv }) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  'w-full border-b px-3 py-3 text-left transition-colors hover:bg-accent/50',
                  selectedId === conv.id && 'bg-accent',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {conv.channel === 'WHATSAPP' ? (
                      <Phone className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
                    )}
                    <p className="truncate text-sm font-medium leading-tight">
                      {conv.waContactName ?? conv.webContactName ?? conv.waContactPhone ?? conv.webVisitorId ?? '—'}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(conv.lastMessage?.createdAt ?? conv.updatedAt)}
                    </span>
                    <StatusBadge status={conv.status} />
                  </div>
                </div>
                {conv.lastMessage && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conv.lastMessage.direction === 'OUTBOUND' ? '↑ ' : ''}
                    {conv.lastMessage.content}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ══ Right Panel ══════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'flex-1 flex flex-col',
          selectedId ? 'flex' : 'hidden md:flex',
        )}
      >
        {/* Back button on mobile */}
        {selectedId && (
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground md:hidden border-b hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to conversations
          </button>
        )}
        {selectedConv ? (
          <ConversationThread
            conversationId={selectedConv.id}
            contactName={selectedConv.waContactName ?? selectedConv.webContactName}
            contactPhone={selectedConv.waContactPhone ?? selectedConv.webVisitorId ?? '—'}
            status={selectedConv.status}
            isSessionOpen={selectedConv.isSessionOpen}
            channel={selectedConv.channel}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
