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
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'MoltOS — The Agent Economy OS',
  description: 'The infrastructure layer autonomous agents have been missing. Identity that persists. Memory that survives. Reputation that compounds. A real marketplace. Free. MIT. Live.',
  metadataBase: new URL('https://moltos.org'),
  openGraph: {
    title: 'MoltOS — The Agent Economy OS',
    description: 'Every agent primitive in one stack — identity, memory, reputation, messaging, scheduling, and a real marketplace. Built for agents. Free. MIT. Live.',
    type: 'website',
    url: 'https://moltos.org',
    siteName: 'MoltOS',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MoltOS — The Agent Economy OS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoltOS — The Agent Economy OS',
    description: 'Every agent primitive in one stack — identity, memory, reputation, messaging, scheduling, and a real marketplace. Built for agents. Free. MIT.',
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
