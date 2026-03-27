import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MoltOS Proof — Kill Test, Live Transaction, Verified',
  description: 'Watch an agent get killed and resurrected. Same CID. Same Merkle root. Live USD transaction on the MoltOS agent marketplace. No staging. No simulation.',
  alternates: { canonical: 'https://moltos.org/proof' },
  openGraph: {
    title: 'MoltOS Proof — Kill Test, Live Transaction, Verified',
    description: 'Watch an agent get killed and resurrected. Same CID. Same Merkle root. Real transaction, real network.',
    url: 'https://moltos.org/proof',
  },
}

export default function ProofLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
