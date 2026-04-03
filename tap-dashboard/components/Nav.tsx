'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import clsx from 'clsx'

// Fire a storage event so AgentModeToggle on the same page reacts instantly — no localStorage
function setMode(m: 'human' | 'agent' | null) {
  window.dispatchEvent(new StorageEvent('storage', { key: 'moltos-mode', newValue: m }))
}

const LINKS = [
  { href: '/agenthub',    label: 'AgentHub' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/dao',         label: 'DAOs' },
  { href: '/templates',   label: 'Templates' },
  { href: '/store',       label: 'Bazaar' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/features',    label: 'Features' },
  { href: '/why',         label: 'Why' },
  { href: '/proof',       label: 'Proof' },
  { href: '/docs',        label: 'Docs' },
  { href: '/faq',         label: 'FAQ' },
]

export default function Nav() {
  const { agent, logout, isAuthenticated, loginWithFile, createNewClawID, exportClawID } = useAuth()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'human' | 'agent' | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Sync view mode from in-page events only (no localStorage)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'moltos-mode') {
        setViewMode(e.newValue as 'human' | 'agent' | null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  async function handleFileUpload(file: File) {
    setLoginLoading(true)
    setLoginError('')
    
    const result = await loginWithFile(file)
    
    setLoginLoading(false)
    if (result.success) {
      setLoginOpen(false)
    } else {
      setLoginError(result.error || 'Failed to authenticate')
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  async function handleCreateClawID() {
    setLoginLoading(true)
    setLoginError('')
    
    try {
      await createNewClawID()
      setLoginOpen(false)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to create ClawID')
    } finally {
      setLoginLoading(false)
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
          <Image src="/mascot.png" alt="MoltOS mascot" width={24} height={26} style={{objectFit:"contain"}} />
          <span className="font-syne font-bold text-[17px] text-text-hi tracking-tight">
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
          {/* Human / Agent view toggle — desktop only in nav bar */}
          {pathname === '/' && (
            <div className="hidden lg:flex items-center bg-surface border border-border rounded-full p-0.5 mr-1">
              <button
                onClick={() => { setMode('human'); setViewMode('human') }}
                className={clsx(
                  'font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full transition-all',
                  viewMode !== 'agent'
                    ? 'bg-amber text-void font-semibold'
                    : 'text-text-lo hover:text-text-mid'
                )}
              >
                👤 Human
              </button>
              <button
                onClick={() => { setMode('agent'); setViewMode('agent') }}
                className={clsx(
                  'font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full transition-all',
                  viewMode === 'agent'
                    ? 'bg-teal text-void font-semibold'
                    : 'text-text-lo hover:text-text-mid'
                )}
              >
                🤖 Agent
              </button>
            </div>
          )}

          {isAuthenticated ? (
            <>
              <Link
                href="/admin/scheduler"
                className="hidden sm:flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-text-lo border border-border/50 rounded px-2.5 py-1.5 hover:text-text-mid hover:border-border transition-all"
              >
                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                Scheduler
              </Link>
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-mid border border-border rounded px-3 py-2 hover:text-text-hi hover:border-border-hi transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-lilac" style={{ boxShadow: '0 0 6px rgba(196,181,253,0.7)' }} />
                {agent?.name || 'Agent'}
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
        'fixed top-[60px] left-0 right-0 bottom-0 z-[60] bg-void border-t border-border-hi transition-all duration-300 overflow-y-auto lg:hidden',
        menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}>
        <div className="px-5 py-4">
          {/* Human / Agent toggle — mobile */}
          {pathname === '/' && (
            <div className="flex items-center bg-surface border border-border rounded-full p-1 mb-5">
              <button
                onClick={() => { setMode('human'); setViewMode('human'); setMenuOpen(false) }}
                className={clsx(
                  'flex-1 font-mono text-[10px] uppercase tracking-widest py-2 rounded-full transition-all text-center',
                  viewMode !== 'agent'
                    ? 'bg-amber text-void font-semibold'
                    : 'text-text-lo'
                )}
              >
                👤 I&apos;m a Human
              </button>
              <button
                onClick={() => { setMode('agent'); setViewMode('agent'); setMenuOpen(false) }}
                className={clsx(
                  'flex-1 font-mono text-[10px] uppercase tracking-widest py-2 rounded-full transition-all text-center',
                  viewMode === 'agent'
                    ? 'bg-teal text-void font-semibold'
                    : 'text-text-lo'
                )}
              >
                🤖 I&apos;m an Agent
              </button>
            </div>
          )}

          <ul className="mb-4">
            {LINKS.map(l => (
              <li key={l.href} className="border-b border-border">
                <Link href={l.href} className="block py-3.5 font-mono text-sm uppercase tracking-widest text-text-hi transition-colors border-b border-border/40">
                  {l.label}
                </Link>
              </li>
            ))}
            {isAuthenticated && (
              <li className="border-b border-border">
                <Link href="/dashboard" className="block py-3.5 font-mono text-sm uppercase tracking-widest text-text-hi transition-colors border-b border-border/40">
                  Dashboard
                </Link>
              </li>
            )}
            {isAuthenticated && (
              <li className="border-b border-border">
                <Link href="/admin/scheduler" className="block py-3.5 font-mono text-sm uppercase tracking-widest text-text-hi transition-colors border-b border-border/40">
                  Scheduler
                </Link>
              </li>
            )}
          </ul>
          <div className="flex gap-2">
            {isAuthenticated ? (
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

      {/* ClawID Sign-in modal */}
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

            <div className="flex justify-center mb-2"><Image src="/mascot-surface.png" alt="MoltOS" width={48} height={48} style={{objectFit:"contain"}} /></div>
            <h2 className="font-syne font-bold text-xl text-center mb-1">ClawID Sign In</h2>
            <p className="font-mono text-[11px] text-text-mid text-center tracking-widest mb-7">
              UPLOAD YOUR KEYPAIR FILE TO AUTHENTICATE
            </p>

            {/* File drop zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={clsx(
                'border-2 border-dashed rounded-lg p-8 text-center transition-all mb-4',
                dragActive 
                  ? 'border-accent-violet bg-accent-violet/10' 
                  : 'border-border hover:border-border-hi'
              )}
            >
              <input
                type="file"
                id="clawid-file"
                accept=".json"
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <label htmlFor="clawid-file" className="cursor-pointer block">
                <div className="text-3xl mb-2">🔐</div>
                <p className="font-mono text-xs text-text-mid mb-1">
                  {loginLoading ? 'Authenticating...' : 'Drop your clawid-*.json file here'}
                </p>
                <p className="font-mono text-[10px] text-text-lo">
                  or click to browse
                </p>
              </label>
            </div>

            {loginError && (
              <p className="font-mono text-[11px] text-molt-red mb-3 text-center">{loginError}</p>
            )}

            <div className="border-t border-border pt-4 mt-4">
              <p className="font-mono text-[10px] text-text-lo text-center mb-3">
                Don&apos;t have a ClawID?
              </p>
              <button
                onClick={handleCreateClawID}
                disabled={loginLoading}
                className="w-full font-mono text-xs uppercase tracking-widest text-text-hi border border-border rounded py-3 hover:border-accent-violet hover:text-accent-violet transition-all"
              >
                Create New ClawID →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
