'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  BOT_QUERY,
  UPDATE_BOT_MUTATION,
} from '@/graphql/bots';
import {
  DOCUMENTS_QUERY,
  CREATE_DOCUMENT_UPLOAD_URL_MUTATION,
  CONFIRM_DOCUMENT_UPLOAD_MUTATION,
  DELETE_DOCUMENT_MUTATION,
} from '@/graphql/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowLeft, Upload, Trash2, FileText, Loader2, RefreshCw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type NoMatchBehavior = 'ESCALATE' | 'REPLY_NO_INFO' | 'IGNORE';
type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

interface Bot {
  id: string;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  noMatchBehavior: NoMatchBehavior;
  maxContextChunks: number;
  temperature: number;
  documentCount: number;
}

interface BotData {
  bot: Bot;
}

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
}

interface DocumentsData {
  documents: Document[];
}

interface CreateUploadUrlData {
  createDocumentUploadUrl: {
    document: { id: string; filename: string; status: string };
    uploadUrl: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles: Record<DocumentStatus, string> = {
    UPLOADING: 'bg-blue-100 text-blue-700',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
    READY: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {(status === 'UPLOADING' || status === 'PROCESSING') && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;

  // ── Bot query ──
  const { data: botData, loading: botLoading } = useQuery<BotData>(BOT_QUERY, {
    variables: { id: botId },
  });

  // ── Documents query (with polling while any doc is processing) ──
  const { data: docsData, refetch: refetchDocs, startPolling, stopPolling } = useQuery<DocumentsData>(
    DOCUMENTS_QUERY,
    { variables: { botId } }
  );

  const documents = docsData?.documents ?? [];
  const hasProcessing = documents.some(
    (d) => d.status === 'PROCESSING' || d.status === 'UPLOADING'
  );

  useEffect(() => {
    if (hasProcessing) {
      startPolling(3000);
    } else {
      stopPolling();
    }
  }, [hasProcessing, startPolling, stopPolling]);

  // ── Mutations ──
  const [updateBot, { loading: updatingBot }] = useMutation(UPDATE_BOT_MUTATION);
  const [createUploadUrl] = useMutation<CreateUploadUrlData>(CREATE_DOCUMENT_UPLOAD_URL_MUTATION);
  const [confirmUpload] = useMutation(CONFIRM_DOCUMENT_UPLOAD_MUTATION);
  const [deleteDocument] = useMutation(DELETE_DOCUMENT_MUTATION, {
    onCompleted: () => refetchDocs(),
  });

  // ── Edit state ──
  const bot = botData?.bot;
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSystemPrompt, setFormSystemPrompt] = useState('');
  const [formTemperature, setFormTemperature] = useState('');
  const [formMaxChunks, setFormMaxChunks] = useState('');
  const [formNoMatch, setFormNoMatch] = useState<NoMatchBehavior>('ESCALATE');

  useEffect(() => {
    if (bot && !editing) {
      setFormName(bot.name);
      setFormSystemPrompt(bot.systemPrompt);
      setFormTemperature(String(bot.temperature));
      setFormMaxChunks(String(bot.maxContextChunks));
      setFormNoMatch(bot.noMatchBehavior);
    }
  }, [bot, editing]);

  async function handleSaveBot() {
    await updateBot({
      variables: {
        id: botId,
        input: {
          name: formName,
          systemPrompt: formSystemPrompt,
          temperature: parseFloat(formTemperature),
          maxContextChunks: parseInt(formMaxChunks, 10),
          noMatchBehavior: formNoMatch,
        },
      },
    });
    setEditing(false);
  }

  // ── Upload state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      // 1. Get presigned URL
      const { data } = await createUploadUrl({
        variables: {
          botId,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });

      if (!data) throw new Error('No upload URL returned');

      const { uploadUrl, document } = data.createDocumentUploadUrl;

      // 2. PUT file to presigned URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.statusText}`);

      // 3. Confirm upload
      await confirmUpload({ variables: { documentId: document.id } });

      // 4. Refresh documents (polling will kick in if status is PROCESSING)
      await refetchDocs();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (botLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium">Bot not found</p>
        <Button variant="outline" onClick={() => router.push('/bots')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to bots
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bots">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{bot.name}</h1>
          <p className="text-sm text-muted-foreground">
            {bot.isActive ? (
              <span className="text-green-600">Active</span>
            ) : (
              <span className="text-gray-500">Inactive</span>
            )}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit Bot
          </Button>
        )}
      </div>

      {/* Bot Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bot-name">Name</Label>
            {editing ? (
              <Input
                id="bot-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            ) : (
              <p className="text-sm">{bot.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="system-prompt">System Prompt</Label>
            {editing ? (
              <textarea
                id="system-prompt"
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{bot.systemPrompt}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="temperature">Temperature</Label>
              {editing ? (
                <Input
                  id="temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formTemperature}
                  onChange={(e) => setFormTemperature(e.target.value)}
                />
              ) : (
                <p className="text-sm">{bot.temperature}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-chunks">Max Context Chunks</Label>
              {editing ? (
                <Input
                  id="max-chunks"
                  type="number"
                  min="1"
                  max="20"
                  value={formMaxChunks}
                  onChange={(e) => setFormMaxChunks(e.target.value)}
                />
              ) : (
                <p className="text-sm">{bot.maxContextChunks}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="no-match">No Match Behavior</Label>
              {editing ? (
                <select
                  id="no-match"
                  value={formNoMatch}
                  onChange={(e) => setFormNoMatch(e.target.value as NoMatchBehavior)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="ESCALATE">Escalate</option>
                  <option value="REPLY_NO_INFO">Reply No Info</option>
                  <option value="IGNORE">Ignore</option>
                </select>
              ) : (
                <p className="text-sm">{bot.noMatchBehavior}</p>
              )}
            </div>
          </div>

          {editing && (
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveBot} disabled={updatingBot}>
                {updatingBot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Documents</CardTitle>
            <div className="flex items-center gap-2">
              {hasProcessing && (
                <span className="flex items-center gap-1 text-xs text-yellow-600">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Processing...
                </span>
              )}
              <Button
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload Document
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.docx"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {uploadError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {documents.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No documents yet</p>
              <p className="text-xs text-muted-foreground">Upload a PDF, TXT, or MD file</p>
            </div>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(doc.sizeBytes)}
                        {doc.status === 'READY' && doc.chunkCount > 0 && (
                          <> · {doc.chunkCount} chunks</>
                        )}
                      </p>
                      {doc.error && (
                        <p className="text-xs text-red-600">{doc.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={doc.status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteDocument({ variables: { id: doc.id } })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
