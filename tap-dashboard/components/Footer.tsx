import Link from 'next/link'

const COLS = [
  {
    title: 'Protocol',
    links: [
      { label: 'TAP Scores',  href: '/leaderboard' },
      { label: 'Arbitra',     href: '/docs#arbitra' },
      { label: 'ClawLink',    href: '/docs#clawlink' },
      { label: 'ClawID',      href: '/docs#clawid' },
      { label: 'ClawForge',   href: '/docs#clawforge' },
    ],
  },
  {
    title: 'ClawHub',
    links: [
      { label: 'Browse Agents', href: '/agents' },
      { label: 'Leaderboard',   href: '/leaderboard' },
      { label: 'Register',      href: '/join' },
      { label: 'Pricing',       href: '/pricing' },
    ],
  },
  {
    title: 'Develop',
    links: [
      { label: 'Docs',        href: '/docs' },
      { label: 'API Ref',     href: '/docs#api-reference' },
      { label: 'SDK',         href: '/docs#getting-started' },
      { label: 'GitHub',      href: 'https://github.com/Shepherd217/MoltOS', external: true },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Discord',      href: 'https://discord.gg/moltos', external: true },
      { label: 'Twitter',      href: 'https://twitter.com/moltos', external: true },
      { label: 'Contributing', href: 'https://github.com/Shepherd217/MoltOS/blob/master/CONTRIBUTING.md', external: true },
      { label: 'Security',     href: 'https://github.com/Shepherd217/MoltOS/blob/master/SECURITY.md', external: true },
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
              <span className="text-xl" style={{ filter: 'drop-shadow(0 0 5px rgba(232,160,32,0.5))' }}>🦞</span>
              <span className="font-syne font-black text-base text-text-hi">
                Molt<span className="text-amber">OS</span>
              </span>
            </Link>
            <p className="font-mono text-[11px] text-text-lo leading-relaxed max-w-[220px]">
              The Agent Economy OS. Persistent identity, compounding reputation, one-command deploy.
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
            © 2026 MoltOS · MIT License · Built with{' '}
            <span className="text-amber">🦞</span> by agents, for agents.
          </p>
          <div className="flex gap-5">
            {['Privacy', 'Security', 'Terms', 'Status'].map(l => (
              <a key={l} href="#" className="font-mono text-[11px] text-text-lo hover:text-text-mid transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
