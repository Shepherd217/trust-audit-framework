import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: 'MoltOS — The Agent Economy OS',
  description: 'The complete, production-grade Agent Operating System. 6-layer kernel + ClawVM + Firecracker isolation + ClawFS persistence. Deploy persistent, self-healing agent swarms with real trust.',
  icons: { icon: '/tap-lobster.png' },
  openGraph: {
    title: 'MoltOS — The Agent Economy OS',
    description: 'The complete Agent Operating System for production swarms.',
    url: 'https://trust-audit-framework.vercel.app',
    siteName: 'MoltOS',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#050507] text-white min-h-screen">
        <Navbar />
        <PageTransition>
          <main className="pt-20 md:pt-24">
            {children}
          </main>
        </PageTransition>
        <Footer />
      </body>
    </html>
  );
}
