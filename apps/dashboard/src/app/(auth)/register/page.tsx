'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@apollo/client/react';
import { REGISTER_MUTATION } from '@/graphql/auth';
import { setTokens } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface AuthPayload {
  accessToken: string;
  refreshToken: string;
}

interface RegisterData {
  register: AuthPayload;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    tenantName: '',
    tenantSlug: '',
  });
  const [error, setError] = useState('');

  const [register, { loading }] = useMutation<RegisterData>(REGISTER_MUTATION, {
    onCompleted: (data) => {
      setTokens(data.register.accessToken, data.register.refreshToken);
      router.push('/inbox');
    },
    onError: (err: { message?: string }) => {
      setError(err.message ?? 'Registration failed');
    },
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

    // Auto-generate slug from tenant name
    if (field === 'tenantName') {
      const slug = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setForm((prev) => ({ ...prev, tenantSlug: slug }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    register({ variables: { input: form } });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Start using arcMessageBot</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={form.firstName} onChange={handleChange('firstName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={form.lastName} onChange={handleChange('lastName')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={handleChange('email')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={handleChange('password')} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenantName">Company name</Label>
            <Input id="tenantName" value={form.tenantName} onChange={handleChange('tenantName')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenantSlug">URL slug</Label>
            <Input id="tenantSlug" value={form.tenantSlug} onChange={handleChange('tenantSlug')} required pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$" />
            <p className="text-xs text-muted-foreground">app.arcmessagebot.com/{form.tenantSlug || 'your-company'}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
