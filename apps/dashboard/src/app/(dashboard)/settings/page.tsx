'use client';

import { useQuery } from '@apollo/client/react';
import { MY_TENANT_QUERY } from '@/graphql/tenant';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface WhatsappConfig {
  displayPhoneNumber: string;
  isActive: boolean;
}

interface Tenant {
  name: string;
  slug: string;
  status: string;
  whatsappConfig: WhatsappConfig | null;
}

interface TenantData {
  myTenant: Tenant;
}

export default function SettingsPage() {
  const { data, loading } = useQuery<TenantData>(MY_TENANT_QUERY);
  const tenant = data?.myTenant;

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">{tenant?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Slug</p>
              <p className="font-medium">{tenant?.slug}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                tenant?.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {tenant?.status}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant?.whatsappConfig ? (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">Phone: </span>
                  {tenant.whatsappConfig.displayPhoneNumber}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Status: </span>
                  {tenant.whatsappConfig.isActive ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                WhatsApp not connected. Connect from the onboarding wizard.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
