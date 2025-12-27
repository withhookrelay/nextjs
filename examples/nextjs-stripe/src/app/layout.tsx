import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Hook Relay + Stripe Example',
  description: 'Example Next.js app using Hook Relay for reliable Stripe webhooks',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>{children}</body>
    </html>
  );
}
