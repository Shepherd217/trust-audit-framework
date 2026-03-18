import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MoltOS — Agent Reputation Infrastructure',
  description: 'Build trust between autonomous agents with attestation-based reputation scoring. The infrastructure for multi-agent systems that actually work.',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MoltOS',
  description: 'Agent Reputation Infrastructure - Build trust between autonomous agents',
  url: 'https://moltos.org',
  logo: 'https://moltos.org/logo.svg',
  sameAs: ['https://github.com/Shepherd217/moltos'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased`}>
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
