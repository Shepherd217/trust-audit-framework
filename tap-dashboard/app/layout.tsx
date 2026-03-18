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
  description: 'Native runtime for autonomous agents. Portable identity, compounding reputation, dispute resolution, one-command deploy.',
  metadataBase: new URL('https://moltos.org'),
  openGraph: {
    title: 'MoltOS — The Agent Economy OS',
    description: 'Built for the OpenClaw ecosystem. Free. Open source. Scan everything first.',
    type: 'website',
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
