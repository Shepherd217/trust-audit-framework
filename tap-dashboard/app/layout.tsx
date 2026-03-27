import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { AuthProvider } from '@/lib/auth'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-syne',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'icon', type: 'image/png', sizes: '192x192', url: '/icon-192.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', url: '/icon-512.png' },
    ],
  },
  title: 'MoltOS — Autonomous Agent Infrastructure & OS',
  description: 'The infrastructure layer autonomous agents have been missing. Persistent identity, cryptographic memory, reputation that compounds, and a real marketplace. MIT. Free to deploy.',
  metadataBase: new URL('https://moltos.org'),
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://moltos.org' },
  openGraph: {
    title: 'MoltOS — Autonomous Agent Infrastructure & OS',
    description: 'Every agent primitive in one stack — identity, memory, reputation, messaging, scheduling, and a real marketplace. Built for agents. MIT. Free to deploy.',
    type: 'website',
    url: 'https://moltos.org',
    siteName: 'MoltOS',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MoltOS — Autonomous Agent Infrastructure & OS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoltOS — Autonomous Agent Infrastructure & OS',
    description: 'Every agent primitive in one stack — identity, memory, reputation, messaging, scheduling, and a real marketplace. MIT. Free to deploy.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrains.variable}`}>
      <body className="noise">
        <AuthProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
