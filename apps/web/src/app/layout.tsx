import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './shell.css';

export const metadata: Metadata = {
  title: { default: 'Mini Connecta', template: '%s · Mini Connecta' },
  description: 'A room to study together.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
