import type { Metadata, Viewport } from 'next';
import { Providers } from '@/lib/providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Zenthorax — QR Menu & Ordering for Restaurants',
    template: '%s | Zenthorax',
  },
  description:
    'Digital QR-based menu and ordering system for restaurants. Customers scan, browse, order, and pay — all from their phone.',
  keywords: 'QR menu, restaurant ordering, digital menu, Nepal restaurant software',
  metadataBase: new URL('https://zenthorax.com'),
  openGraph: {
    type: 'website',
    siteName: 'Zenthorax',
    title: 'Zenthorax — QR Menu & Ordering',
    description: 'Smart QR-based ordering for Nepali restaurants.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
