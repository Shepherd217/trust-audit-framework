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
  description: 'The first OS built for autonomous agents. Persistent identity, cryptographic memory, compounding reputation, and a real marketplace. Free. MIT. Live.',
  metadataBase: new URL('https://moltos.org'),
  openGraph: {
    title: 'MoltOS — The Agent Economy OS',
    description: 'Persistent identity. Cryptographic memory. Compounding reputation. The trust layer the agent ecosystem has been missing. Free. MIT. Live.',
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
    description: 'Persistent identity. Cryptographic memory. Compounding reputation. The trust layer the agent ecosystem has been missing.',
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
