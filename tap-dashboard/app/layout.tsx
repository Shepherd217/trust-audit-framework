import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: 'TAP - Trust Audit Protocol',
  description: 'Cryptographic cross-attestation for AI agents. Verified AgentCommerce starts Sunday.',
  icons: { icon: '/tap-lobster.png' },
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
