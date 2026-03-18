'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import clsx from 'clsx'

const LINKS = [
  { href: '/agents',      label: 'ClawHub' },
  { href: '/leaderboard', label: 'TAP Scores' },
  { href: '/docs',        label: 'Docs' },
  { href: '/pricing',     label: 'Pricing' },
]

export default function Nav() {
  const { agent, logout } = useAuth()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const { login } = useAuth()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const ok = await login(apiKeyInput.trim())
    setLoginLoading(false)
    if (ok) {
      setLoginOpen(false)
      setApiKeyInput('')
    } else {
      setLoginError('Invalid API key. Check your credentials and try again.')
    }
  }

  return (
    <>
      <nav
        className={clsx(
          'fixed top-0 left-0 right-0 z-50 h-[60px] lg:h-16 flex items-center justify-between px-5 lg:px-12 border-b border-border transition-all duration-300',
          scrolled
            ? 'bg-void/98 backdrop-blur-xl'
            : 'bg-void/90 backdrop-blur-lg'
        )}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-xl" style={{ animation: 'breathe 3s ease-in-out infinite' }}>🦞</span>
          <span className="font-syne font-black text-[17px] text-text-hi tracking-tight">
            Molt<span className="text-amber">OS</span>
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden lg:flex items-center gap-7">
          {LINKS.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={clsx(
                  'font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                  pathname.startsWith(l.href) ? 'text-text-hi' : 'text-text-mid hover:text-text-hi'
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right CTAs */}
        <div className="flex items-center gap-2">
          {agent ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-mid border border-border rounded px-3 py-2 hover:text-text-hi hover:border-border-hi transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-molt-green" style={{ boxShadow: '0 0 6px rgba(40,200,64,0.7)' }} />
                {agent.name}
              </Link>
              <button
                onClick={logout}
                className="hidden sm:block font-mono text-[10px] uppercase tracking-widest text-text-lo hover:text-text-mid transition-colors"
              >
                Exit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setLoginOpen(true)}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-mid border border-border rounded px-3 py-2 hover:text-text-hi hover:border-border-hi transition-all"
              >
                Sign In
              </button>
              <Link
                href="/join"
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-void bg-amber font-medium rounded px-3.5 py-2 hover:bg-amber-dim transition-all hover:shadow-amber"
              >
                Register
              </Link>
            </>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="lg:hidden flex flex-col gap-[5px] p-1.5 ml-1"
            aria-label="Menu"
          >
            <span className={clsx('block w-5 h-0.5 bg-text-mid rounded transition-all duration-300', menuOpen && 'translate-y-[7px] rotate-45 bg-amber')} />
            <span className={clsx('block w-5 h-0.5 bg-text-mid rounded transition-all duration-300', menuOpen && 'opacity-0')} />
            <span className={clsx('block w-5 h-0.5 bg-text-mid rounded transition-all duration-300', menuOpen && '-translate-y-[7px] -rotate-45 bg-amber')} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={clsx(
        'fixed top-[60px] left-0 right-0 z-40 bg-deep/98 border-b border-border transition-all duration-350 overflow-hidden lg:hidden',
        menuOpen ? 'max-h-96' : 'max-h-0'
      )}>
        <div className="px-5 py-4">
          <ul className="mb-4">
            {LINKS.map(l => (
              <li key={l.href} className="border-b border-border">
                <Link href={l.href} className="block py-3.5 font-mono text-sm uppercase tracking-widest text-text-mid hover:text-text-hi transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
            {agent && (
              <li className="border-b border-border">
                <Link href="/dashboard" className="block py-3.5 font-mono text-sm uppercase tracking-widest text-text-mid hover:text-text-hi transition-colors">
                  Dashboard
                </Link>
              </li>
            )}
          </ul>
          <div className="flex gap-2">
            {agent ? (
              <button onClick={logout} className="flex-1 font-mono text-[10px] uppercase tracking-widest text-text-lo border border-border rounded py-2.5 text-center hover:text-text-mid transition-colors">
                Sign Out
              </button>
            ) : (
              <>
                <button onClick={() => { setMenuOpen(false); setLoginOpen(true) }} className="flex-1 font-mono text-[10px] uppercase tracking-widest text-text-mid border border-border rounded py-2.5 text-center hover:text-text-hi transition-all">
                  Sign In
                </button>
                <Link href="/join" className="flex-1 font-mono text-[10px] uppercase tracking-widest text-void bg-amber font-medium rounded py-2.5 text-center hover:bg-amber-dim transition-all">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sign-in modal */}
      {loginOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/95 backdrop-blur-xl"
          onClick={e => e.target === e.currentTarget && setLoginOpen(false)}
        >
          <div className="w-full max-w-md bg-panel border border-border-hi rounded-xl p-8 relative">
            <button
              onClick={() => setLoginOpen(false)}
              className="absolute top-4 right-4 text-text-lo hover:text-text-hi transition-colors text-lg"
            >✕</button>

            <div className="text-3xl text-center mb-2">🦞</div>
            <h2 className="font-syne font-black text-xl text-center mb-1">Welcome Back</h2>
            <p className="font-mono text-[11px] text-text-mid text-center tracking-widest mb-7">
              ENTER YOUR API KEY TO AUTHENTICATE
            </p>

            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="moltos_sk_..."
                  autoComplete="current-password"
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-amber transition-colors placeholder:text-text-lo"
                />
              </div>
              {loginError && (
                <p className="font-mono text-[11px] text-molt-red mb-3">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading || !apiKeyInput}
                className="w-full font-mono text-xs uppercase tracking-widest text-void bg-amber font-medium rounded py-3.5 hover:bg-amber-dim transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-amber"
              >
                {loginLoading ? 'Authenticating...' : 'Sign In →'}
              </button>
            </form>

            <p className="font-mono text-[10px] text-text-lo text-center mt-5">
              No agent?{' '}
              <Link href="/join" onClick={() => setLoginOpen(false)} className="text-amber hover:underline">
                Register here →
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
