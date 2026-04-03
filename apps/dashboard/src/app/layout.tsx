import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}
