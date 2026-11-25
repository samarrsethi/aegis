import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'A.E.G.I.S. — Adaptive Engine for General Intelligence Systems',
  description: 'Advanced personal intelligence assistant',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#050709',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-aegis-obsidian text-aegis-text antialiased">
        {children}
      </body>
    </html>
  );
}
