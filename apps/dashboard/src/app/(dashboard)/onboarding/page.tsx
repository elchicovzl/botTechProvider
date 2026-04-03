'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { CheckCircle, Copy, Check } from 'lucide-react';
import { MY_TENANT_QUERY, ACTIVATE_WHATSAPP_SANDBOX_MUTATION } from '@/graphql/tenant';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WhatsAppConfig {
  isActive: boolean;
  displayPhoneNumber?: string | null;
}

interface Tenant {
  id: string;
  name: string;
  status: string;
  whatsappConfig: WhatsAppConfig | null;
}

interface TenantData {
  myTenant: Tenant;
}

const SANDBOX_NUMBER = '+14155238886';
const JOIN_CODE = 'join entirely-came';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function OnboardingPage() {
  const { data, loading, refetch } = useQuery<TenantData>(MY_TENANT_QUERY);
  const [activate, { loading: activating }] = useMutation(ACTIVATE_WHATSAPP_SANDBOX_MUTATION, {
    onCompleted: () => refetch(),
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const isConnected = data?.myTenant?.whatsappConfig?.isActive === true;
  const phoneNumber = data?.myTenant?.whatsappConfig?.displayPhoneNumber;

  if (isConnected) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">WhatsApp</h1>
        <Card className="max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">WhatsApp Connected</h2>
            {phoneNumber && (
              <p className="text-muted-foreground">
                Connected number:{' '}
                <span className="font-medium text-foreground">{phoneNumber}</span>
              </p>
            )}
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Active
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">WhatsApp Setup</h1>
      <p className="mb-8 text-muted-foreground">
        Connect your WhatsApp using the Twilio Sandbox for testing.
      </p>

      <div className="max-w-lg space-y-4">
        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              Save our number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center rounded-md bg-muted px-4 py-3">
              <span className="font-mono text-lg font-semibold">{SANDBOX_NUMBER}</span>
              <CopyButton text={SANDBOX_NUMBER} />
            </div>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              Send the join code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open WhatsApp and send this exact message to the number above:
            </p>
            <div className="flex items-center rounded-md bg-muted px-4 py-3">
              <span className="font-mono font-semibold">&ldquo;{JOIN_CODE}&rdquo;</span>
              <CopyButton text={JOIN_CODE} />
            </div>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              Activate connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Once you&apos;ve sent the join code, click the button below to activate your
              WhatsApp connection.
            </p>
            <Button
              onClick={() => activate()}
              disabled={activating}
              className="w-full"
            >
              {activating ? 'Activating...' : 'Activate WhatsApp'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
