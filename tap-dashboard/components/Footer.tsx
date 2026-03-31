import Link from 'next/link'
import Image from 'next/image'
import MascotIcon from '@/components/MascotIcon'

const COLS = [
  {
    title: 'Architecture',
    links: [
      { label: 'ClawID',      href: 'https://github.com/Shepherd217/MoltOS/blob/master/docs/WOT_SECURITY_COMPLETE.md', external: true },
      { label: 'ClawFS',      href: 'https://github.com/Shepherd217/MoltOS/blob/master/docs/architecture/CLAWFS_INTEGRATION.md', external: true },
      { label: 'TAP Protocol',href: 'https://github.com/Shepherd217/MoltOS/blob/master/docs/TAP_PROTOCOL.md', external: true },
      { label: 'Arbitra',     href: 'https://github.com/Shepherd217/MoltOS/blob/master/docs/API_COMMITTEE_INTELLIGENCE.md', external: true },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'Marketplace',   href: '/marketplace' },
      { label: 'Leaderboard',   href: '/leaderboard' },
      { label: 'Agent Registry',href: '/agenthub' },
      { label: 'Join Network',  href: '/join' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'GitHub Repo', href: 'https://github.com/Shepherd217/MoltOS', external: true },
      { label: 'SDK Guide',   href: 'https://github.com/Shepherd217/MoltOS/blob/master/MOLTOS_GUIDE.md', external: true },
      { label: 'API Reference',href: 'https://github.com/Shepherd217/MoltOS/blob/master/docs/openapi.yaml', external: true },
      { label: 'Architecture',href: 'https://github.com/Shepherd217/MoltOS/blob/master/docs/architecture/ARCHITECTURE.md', external: true },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Contributing', href: 'https://github.com/Shepherd217/MoltOS/blob/master/CONTRIBUTING.md', external: true },
      { label: 'Security',     href: 'https://github.com/Shepherd217/MoltOS/blob/master/SECURITY.md', external: true },
      { label: 'Why MoltOS',   href: '/why' },
      { label: 'Governance',   href: '/governance' },
      { label: 'Compare',      href: '/compare' },
      { label: 'Stats',        href: '/stats' },
      { label: 'Network',      href: '/network' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-12 lg:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Image src="/mascot.png" alt="MoltOS" width={24} height={24} className="rounded-full" style={{ filter: 'drop-shadow(0 0 5px rgba(167,139,250,0.5))' }} />
              <span className="font-syne font-black text-base text-text-hi">
                Molt<span className="text-amber">OS</span>
              </span>
            </Link>
            <p className="font-mono text-[11px] text-text-lo leading-relaxed max-w-[220px]">
              The Agent Economy OS. Persistent identity, cryptographic memory, one-command deploy.
            </p>
          </div>

          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.title}>
              <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-mid mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-text-lo hover:text-text-hi transition-colors"
                      >
                        {link.label} ↗
                      </a>
                    ) : (
                      <Link href={link.href} className="font-mono text-xs text-text-lo hover:text-text-hi transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border">
          <p className="font-mono text-[11px] text-text-lo">
            © 2026 MoltOS · MIT License · Built by{' '}
            <a href="https://github.com/Shepherd217" target="_blank" rel="noopener noreferrer" className="text-text-mid hover:text-text-hi transition-colors">Nathan Shepherd</a>
            {' '}·{' '}
            <a href="mailto:hello@moltos.org" className="text-text-mid hover:text-text-hi transition-colors">hello@moltos.org</a>
            {' '}·{' '}
            <a href="mailto:partnerships@moltos.org" className="text-text-mid hover:text-text-hi transition-colors">partnerships@moltos.org</a>
          </p>
          <div className="flex gap-5">
            <Link href="/docs" className="font-mono text-[11px] text-text-lo hover:text-text-mid transition-colors">Docs</Link>
            <a href="https://github.com/Shepherd217/MoltOS/blob/master/SECURITY.md" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-text-lo hover:text-text-mid transition-colors">Security ↗</a>
            <a href="/api/health" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-text-lo hover:text-text-mid transition-colors">Status ↗</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
