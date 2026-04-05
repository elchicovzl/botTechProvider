'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  Loader2,
  RefreshCw,
  Settings,
  Files,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type NoMatchBehavior = 'ESCALATE' | 'REPLY_NO_INFO' | 'IGNORE';
type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
type TabId = 'configuration' | 'documents';

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
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status],
      )}
    >
      {(status === 'UPLOADING' || status === 'PROCESSING') && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {status}
    </span>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-500' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  filename,
  onConfirm,
  onCancel,
}: {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Delete document</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">{filename}</span>? This action cannot be
              undone.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const { toast } = useToast();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<TabId>('configuration');

  // ── Bot query ──
  const { data: botData, loading: botLoading } = useQuery<BotData>(BOT_QUERY, {
    variables: { id: botId },
  });

  // ── Documents query (with polling while any doc is processing) ──
  const {
    data: docsData,
    refetch: refetchDocs,
    startPolling,
    stopPolling,
  } = useQuery<DocumentsData>(DOCUMENTS_QUERY, { variables: { botId } });

  const documents = docsData?.documents ?? [];
  const hasProcessing = documents.some(
    (d) => d.status === 'PROCESSING' || d.status === 'UPLOADING',
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
  const [createUploadUrl] = useMutation<CreateUploadUrlData>(
    CREATE_DOCUMENT_UPLOAD_URL_MUTATION,
  );
  const [confirmUpload] = useMutation(CONFIRM_DOCUMENT_UPLOAD_MUTATION);
  const [deleteDocument] = useMutation(DELETE_DOCUMENT_MUTATION, {
    onCompleted: () => {
      refetchDocs();
      toast('Document deleted', 'success');
    },
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
    toast('Bot updated!', 'success');
  }

  async function handleToggleActive(newValue: boolean) {
    await updateBot({
      variables: {
        id: botId,
        input: { isActive: newValue },
      },
    });
    toast(newValue ? 'Bot activated' : 'Bot deactivated', 'success');
  }

  // ── Upload state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleUploadFile(file: File) {
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
      toast('Document uploaded — processing...', 'info');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUploadFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [botId],
  );

  // ── Delete confirm state ──
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  function requestDelete(doc: Document) {
    setDeleteTarget(doc);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteDocument({ variables: { id: deleteTarget.id } });
    setDeleteTarget(null);
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
    <>
      {/* Delete confirm dialog (portal-like, rendered at root) */}
      {deleteTarget && (
        <DeleteConfirmDialog
          filename={deleteTarget.filename}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

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
              {bot.documentCount} document{bot.documentCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Active / Inactive toggle */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                bot.isActive ? 'text-green-600' : 'text-muted-foreground',
              )}
            >
              {bot.isActive ? 'Active' : 'Inactive'}
            </span>
            <ToggleSwitch
              checked={bot.isActive}
              onChange={handleToggleActive}
              disabled={updatingBot}
            />
          </div>

          {!editing && activeTab === 'configuration' && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit Bot
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex gap-1">
            {(
              [
                { id: 'configuration', label: 'Configuration', icon: Settings },
                { id: 'documents', label: 'Documents', icon: Files },
              ] as { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  if (id === 'configuration' && editing) setEditing(false);
                }}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab: Configuration ─────────────────────────────────────────────── */}
        {activeTab === 'configuration' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
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

              {/* System Prompt */}
              <div className="space-y-1.5">
                <Label htmlFor="system-prompt">System Prompt</Label>
                {editing ? (
                  <textarea
                    id="system-prompt"
                    value={formSystemPrompt}
                    onChange={(e) => setFormSystemPrompt(e.target.value)}
                    rows={8}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm text-foreground leading-relaxed">
                    {bot.systemPrompt}
                  </pre>
                )}
              </div>

              {/* Settings grid — 1 col on mobile, 2 on sm, 3 on md+ */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
        )}

        {/* ── Tab: Documents ─────────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
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
                    Upload
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
            <CardContent className="space-y-4">
              {uploadError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              )}

              {/* Drag-and-drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-5 text-center transition-colors duration-150',
                  dragOver
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-muted-foreground/25 text-muted-foreground hover:border-primary/50 hover:bg-muted/40',
                  uploading && 'pointer-events-none opacity-60',
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                    <p className="text-sm font-medium">Uploading…</p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-2 h-6 w-6" />
                    <p className="text-sm font-medium">
                      {dragOver ? 'Drop to upload' : 'Drag & drop a file here'}
                    </p>
                    <p className="mt-0.5 text-xs">PDF, TXT, MD or DOCX · or click to browse</p>
                  </>
                )}
              </div>

              {/* Document list or empty state */}
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg bg-muted/30 py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold">No documents yet</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Upload your first document to give this bot context. Drag a file above or
                    click{' '}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload
                    </button>
                    .
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-3">
                      <div className="flex min-w-0 items-center gap-3">
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
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge status={doc.status} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => requestDelete(doc)}
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
        )}
      </div>
    </>
  );
}
