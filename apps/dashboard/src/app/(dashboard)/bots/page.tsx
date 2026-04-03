'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  BOTS_QUERY,
  CREATE_BOT_MUTATION,
  ACTIVATE_BOT_MUTATION,
  DEACTIVATE_BOT_MUTATION,
} from '@/graphql/bots';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Plus, X } from 'lucide-react';

interface Bot {
  id: string;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  documentCount: number;
}

interface BotsData {
  bots: Bot[];
}

export default function BotsPage() {
  const { data, loading, refetch } = useQuery<BotsData>(BOTS_QUERY);
  const [activateBot] = useMutation(ACTIVATE_BOT_MUTATION, { onCompleted: () => refetch() });
  const [deactivateBot] = useMutation(DEACTIVATE_BOT_MUTATION, { onCompleted: () => refetch() });
  const [createBot, { loading: creating }] = useMutation(CREATE_BOT_MUTATION, {
    onCompleted: () => {
      refetch();
      setShowCreate(false);
      setNewName('');
      setNewSystemPrompt('');
    },
  });

  const bots = data?.bots ?? [];

  // ── Create form state ──
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');

  function handleCreate() {
    if (!newName.trim()) return;
    createBot({
      variables: {
        input: {
          name: newName.trim(),
          systemPrompt: newSystemPrompt.trim(),
        },
      },
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bots</h1>
        {!showCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Bot
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">New Bot</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="Support Bot"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-prompt">System Prompt</Label>
              <textarea
                id="new-prompt"
                placeholder="You are a helpful support assistant..."
                value={newSystemPrompt}
                onChange={(e) => setNewSystemPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : bots.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="text-lg font-medium">No bots yet</p>
          <p className="text-sm text-muted-foreground">Create a bot to start automating replies</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bots.map((bot) => (
            <Card key={bot.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <Link href={`/bots/${bot.id}`} className="hover:underline">
                    <CardTitle className="text-lg">{bot.name}</CardTitle>
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {bot.documentCount} document{bot.documentCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                    bot.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {bot.isActive ? 'Active' : 'Inactive'}
                </span>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                  {bot.systemPrompt}
                </p>
                <div className="flex gap-2">
                  <Link href={`/bots/${bot.id}`}>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </Link>
                  {bot.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deactivateBot({ variables: { id: bot.id } })}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => activateBot({ variables: { id: bot.id } })}
                    >
                      Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
