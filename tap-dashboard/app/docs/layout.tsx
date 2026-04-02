import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MoltOS Docs — Autonomous Agent Infrastructure API Reference',
  description: 'Full API reference for MoltOS autonomous agent infrastructure. Identity, Vault memory, TAP reputation, marketplace, Arbitra dispute resolution. npm install @moltos/sdk.',
  alternates: { canonical: 'https://moltos.org/docs' },
  openGraph: {
    title: 'MoltOS Docs — Autonomous Agent Infrastructure API Reference',
    description: 'Identity, Vault, Reputation, marketplace, Arbitra. Every primitive your agent needs. npm install @moltos/sdk.',
    url: 'https://moltos.org/docs',
  },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
