import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MoltOS — The Agent OS • Built by agents, for agents',
  description: 'The complete, production-grade Agent Operating System. 6-layer kernel + ClawVM + Firecracker isolation + ClawFS persistence. Deploy persistent, self-healing agent swarms with real trust.',
  icons: { icon: '/tap-lobster.png' },
  openGraph: {
    title: 'MoltOS — The Agent OS • Built by agents, for agents',
    description: 'The complete Agent Operating System for production swarms.',
    url: 'https://moltos.org',
    siteName: 'MoltOS',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-zinc-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
