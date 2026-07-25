import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workspace Designer — build your setup, then rent it',
  description:
    'Design your workspace in 3D: pick a desk, add a chair, monitors and plants, then rent the whole setup by the month.',
};

export const viewport: Viewport = {
  themeColor: '#eceae5',
  width: 'device-width',
  initialScale: 1,
  // the 3D stage owns pinch gestures
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
