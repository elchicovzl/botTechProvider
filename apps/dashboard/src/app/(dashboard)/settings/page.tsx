'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import Link from 'next/link';
import {
  MY_TENANT_QUERY,
  UPDATE_TENANT_MUTATION,
  GENERATE_WIDGET_API_KEY_MUTATION,
  UPDATE_ALLOWED_ORIGINS_MUTATION,
} from '@/graphql/tenant';
import { ME_QUERY } from '@/graphql/auth';
import { BOTS_QUERY } from '@/graphql/bots';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

// ── Types ──────────────────────────────────────────────────────────────────

interface WhatsappConfig {
  isActive: boolean;
  displayPhoneNumber: string;
  phoneVerificationStatus: string;
  connectedAt: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  widgetApiKey: string | null;
  allowedOrigins: string[];
  whatsappConfig: WhatsappConfig | null;
}

interface TenantData {
  myTenant: Tenant;
}

interface MeData {
  me: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface Bot {
  id: string;
  name: string;
  isActive: boolean;
}

interface BotsData {
  bots: Bot[];
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: tenantData, loading: tenantLoading } = useQuery<TenantData>(MY_TENANT_QUERY);
  const { data: meData, loading: meLoading } = useQuery<MeData>(ME_QUERY);
  const { data: botsData, loading: botsLoading } = useQuery<BotsData>(BOTS_QUERY);

  const tenant = tenantData?.myTenant;
  const me = meData?.me;
  const bots = botsData?.bots ?? [];
  const activeBot = bots.find((b) => b.isActive) ?? null;

  const [companyName, setCompanyName] = useState('');
  const [origins, setOrigins] = useState<string[]>([]);
  const [newOrigin, setNewOrigin] = useState('');
  const [originError, setOriginError] = useState('');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  useEffect(() => {
    if (tenant?.name) setCompanyName(tenant.name);
  }, [tenant?.name]);

  useEffect(() => {
    if (tenant?.allowedOrigins) setOrigins(tenant.allowedOrigins);
  }, [tenant?.allowedOrigins]);

  const [updateTenant, { loading: saving }] = useMutation(UPDATE_TENANT_MUTATION, {
    onCompleted: () => toast('Company name updated', 'success'),
    onError: (err) => toast(err.message, 'error'),
    refetchQueries: [{ query: MY_TENANT_QUERY }],
  });

  const [generateKey, { loading: generatingKey }] = useMutation(GENERATE_WIDGET_API_KEY_MUTATION, {
    onCompleted: () => toast('API key generated', 'success'),
    onError: (err) => toast(err.message, 'error'),
    refetchQueries: [{ query: MY_TENANT_QUERY }],
  });

  const [updateOrigins, { loading: savingOrigins }] = useMutation(UPDATE_ALLOWED_ORIGINS_MUTATION, {
    onCompleted: () => toast('Allowed origins updated', 'success'),
    onError: (err) => toast(err.message, 'error'),
    refetchQueries: [{ query: MY_TENANT_QUERY }],
  });

  const handleGenerateKey = () => {
    if (tenant?.widgetApiKey && !showRegenConfirm) {
      setShowRegenConfirm(true);
      return;
    }
    setShowRegenConfirm(false);
    generateKey();
  };

  const handleAddOrigin = () => {
    const trimmed = newOrigin.trim();
    if (!trimmed) return;
    try {
      const normalized = new URL(trimmed).origin;
      if (origins.includes(normalized)) {
        setOriginError('Origin already added');
        return;
      }
      setOrigins([...origins, normalized]);
      setNewOrigin('');
      setOriginError('');
    } catch {
      setOriginError('Invalid URL (e.g., https://example.com)');
    }
  };

  const handleRemoveOrigin = (origin: string) => {
    setOrigins(origins.filter((o) => o !== origin));
  };

  const handleSaveOrigins = () => {
    updateOrigins({ variables: { origins } });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast('Copied to clipboard', 'success'),
      () => toast('Failed to copy', 'error'),
    );
  };

  const handleSaveName = () => {
    const trimmed = companyName.trim();
    if (!trimmed) return toast('Name cannot be empty', 'error');
    if (trimmed === tenant?.name) return toast('No changes to save', 'info');
    updateTenant({ variables: { name: trimmed } });
  };

  const isLoading = tenantLoading || meLoading || botsLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* ── Section 1: User Profile ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground text-sm">First Name</Label>
                <p className="font-medium mt-1">{me?.firstName ?? '—'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Last Name</Label>
                <p className="font-medium mt-1">{me?.lastName ?? '—'}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Email</Label>
              <p className="font-medium mt-1">{me?.email ?? '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Role</Label>
              <span className="inline-block mt-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                {me?.role ?? '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Company Info ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Company Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <div className="flex gap-2">
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  className="flex-1"
                />
                <Button onClick={handleSaveName} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-sm">Slug</Label>
              <p className="font-medium mt-1 font-mono text-sm">{tenant?.slug ?? '—'}</p>
            </div>

            <div>
              <Label className="text-muted-foreground text-sm">Status</Label>
              <div className="mt-1">
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                    tenant?.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {tenant?.status ?? '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 3: WhatsApp Connection ───────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant?.whatsappConfig ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Connected</span>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Phone Number</Label>
                  <p className="font-medium mt-1">{tenant.whatsappConfig.displayPhoneNumber}</p>
                </div>
                {tenant.whatsappConfig.connectedAt && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Connected Since</Label>
                    <p className="font-medium mt-1">
                      {new Date(tenant.whatsappConfig.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground text-sm">Verification Status</Label>
                  <p className="font-medium mt-1">{tenant.whatsappConfig.phoneVerificationStatus}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  <span className="text-sm text-muted-foreground">Not connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your WhatsApp number to start receiving and sending messages.
                </p>
                <Link href="/onboarding" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Set up WhatsApp
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Bot Overview ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Bot Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeBot ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Active bot:</span>
                  <span className="text-sm">{activeBot.name}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                <span className="text-sm text-muted-foreground">No active bot</span>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground text-sm">Total bots</Label>
              <p className="font-medium mt-1">{bots.length}</p>
            </div>

            <Link href="/bots" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Manage bots
            </Link>
          </CardContent>
        </Card>

        {/* ── Section 5: Widget Security ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Widget Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">API Key</Label>
              {tenant?.widgetApiKey ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={tenant.widgetApiKey}
                      readOnly
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(tenant.widgetApiKey!)}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={generatingKey}
                      onClick={handleGenerateKey}
                    >
                      {generatingKey ? 'Generating…' : 'Regenerate'}
                    </Button>
                  </div>
                  {showRegenConfirm && (
                    <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                      <p className="font-medium">Are you sure?</p>
                      <p className="text-xs mt-1">This will immediately invalidate the current key. All existing widget embeds will stop working until updated.</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="destructive" disabled={generatingKey} onClick={() => { setShowRegenConfirm(false); generateKey(); }}>
                          {generatingKey ? 'Generating…' : 'Yes, regenerate'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowRegenConfirm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No API key generated yet. Without a key, anyone can embed your widget.
                  </p>
                  <Button size="sm" disabled={generatingKey} onClick={handleGenerateKey}>
                    {generatingKey ? 'Generating…' : 'Generate API Key'}
                  </Button>
                </div>
              )}
            </div>

            {/* Allowed Origins */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Allowed Origins</Label>
              {origins.length === 0 && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                  Your widget accepts requests from any domain. Add allowed origins for better security.
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newOrigin}
                  onChange={(e) => { setNewOrigin(e.target.value); setOriginError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddOrigin()}
                  placeholder="https://example.com"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={handleAddOrigin}>
                  Add
                </Button>
              </div>
              {originError && (
                <p className="text-xs text-red-600">{originError}</p>
              )}
              {origins.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {origins.map((origin) => (
                    <span
                      key={origin}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {origin}
                      <button
                        onClick={() => handleRemoveOrigin(origin)}
                        className="ml-1 text-blue-500 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {origins.length > 0 && (
                <Button
                  size="sm"
                  disabled={savingOrigins}
                  onClick={handleSaveOrigins}
                >
                  {savingOrigins ? 'Saving…' : 'Save Origins'}
                </Button>
              )}
            </div>

            {/* Embed Snippet */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Embed Snippet</Label>
              {tenant?.widgetApiKey ? (
                (() => {
                  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/graphql$/, '');
                  const snippet = `<script src="${apiBase}/widget/v1/widget.min.js" data-key="${tenant.widgetApiKey}"></script>`;
                  return (
                    <div className="relative">
                      <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-sm font-mono">
                        {snippet}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => handleCopy(snippet)}
                      >
                        Copy
                      </Button>
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm text-muted-foreground">Generate an API key first to get your embed snippet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
