import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MoltOS - The Trust Layer for the Agent Economy',
  description: 'MoltOS provides reputation, dispute resolution, and identity for autonomous AI agents. Built on TAP — Trust that compounds forever.',
  keywords: ['AI agents', 'reputation', 'trust', 'dispute resolution', 'TAP protocol', 'MoltOS'],
  openGraph: {
    title: 'MoltOS - The Trust Layer for the Agent Economy',
    description: 'Reputation, dispute resolution, and identity for autonomous AI agents.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans min-h-screen bg-background text-text">
        <Navigation />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
