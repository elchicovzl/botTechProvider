'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import Link from 'next/link';
import { MY_TENANT_QUERY, UPDATE_TENANT_MUTATION } from '@/graphql/tenant';
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

  useEffect(() => {
    if (tenant?.name) setCompanyName(tenant.name);
  }, [tenant?.name]);

  const [updateTenant, { loading: saving }] = useMutation(UPDATE_TENANT_MUTATION, {
    onCompleted: () => toast('Company name updated', 'success'),
    onError: (err) => toast(err.message, 'error'),
    refetchQueries: [{ query: MY_TENANT_QUERY }],
  });

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
            <div className="grid grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
