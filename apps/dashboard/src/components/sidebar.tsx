'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Bot, Settings, LogOut, MessageCircle, Menu, X } from 'lucide-react';
import { useQuery } from '@apollo/client/react';
import { cn } from '@/lib/utils';
import { clearTokens } from '@/lib/auth';
import { ME_QUERY } from '@/graphql/auth';

interface MeData {
  me: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

const navItems = [
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/onboarding', label: 'WhatsApp', icon: MessageCircle },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: userData } = useQuery<MeData>(ME_QUERY);
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile hamburger - fixed top-left */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 rounded-lg bg-white p-2 shadow-md md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo + mobile close button */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <h1 className="text-lg font-bold text-primary">arcMessageBot</h1>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 hover:bg-accent md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + Logout */}
        <div className="border-t border-sidebar-border p-3">
          {userData?.me && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium truncate">
                {userData.me.firstName} {userData.me.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{userData.me.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
