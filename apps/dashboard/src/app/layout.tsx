import type { Metadata } from 'next';
import './globals.css';
import { ApolloProvider } from '@/lib/apollo-provider';

export const metadata: Metadata = {
  title: 'arcMessageBot',
  description: 'WhatsApp Business SaaS Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ApolloProvider>{children}</ApolloProvider>
      </body>
    </html>
  );
}
