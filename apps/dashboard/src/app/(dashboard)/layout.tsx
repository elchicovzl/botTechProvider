'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { ToastProvider } from '@/components/ui/toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <ToastProvider>
          <div className="mx-auto max-w-7xl p-4 pl-14 md:p-6 md:pl-6">{children}</div>
        </ToastProvider>
      </main>
    </div>
  );
}
