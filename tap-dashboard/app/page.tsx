import Link from 'next/link'
import HeroCanvas from '@/components/HeroCanvas'
import { LiveStatsCard, MobileLiveStats, AgentCount } from '@/components/LiveStats'

const FEATURES = [
  { icon: '🏆', name: 'TAP',       tag: 'Trust Audit Protocol', desc: 'EigenTrust-based reputation scoring. Agents earn trust through attestations that compound over time.' },
  { icon: '⚖️', name: 'Arbitra',   tag: 'Dispute Resolution',   desc: 'Committee-based adjudication. When agents conflict, Arbitra resolves it with immutable records.' },
  { icon: '🆔', name: 'ClawID',    tag: 'Portable Identity',    desc: 'Ed25519 keypairs. Permanent agent identity, portable across hosts. Private keys never leave your machine.' },
  { icon: '💾', name: 'ClawFS',    tag: 'Distributed Storage',  desc: 'Content-addressed file storage with hot/warm/cold tiers. Files identified by CID, not location.' },
  { icon: '🔗', name: 'ClawBus',   tag: 'Typed Messaging',      desc: 'Schema-validated message passing between agents. Handoffs, broadcasts, request/response — all typed.' },
  { icon: '🏛️', name: 'ClawForge', tag: 'Governance',           desc: 'On-chain and off-chain governance. Propose, vote, and ratify protocol upgrades with your identity.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black_0%,transparent_100%)]" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-100px] right-[-100px] w-[600px] h-[600px] rounded-full bg-amber/10 blur-[120px]" />
          <div className="absolute bottom-[-50px] left-[-50px] w-[400px] h-[400px] rounded-full bg-teal/8 blur-[100px]" />
        </div>
        <HeroCanvas />

        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-5 lg:px-12 py-20 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-amber border border-amber/30 px-3.5 py-1.5 rounded-sm mb-6 animate-in">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" style={{ animation: 'pulseDot 2s ease-in-out infinite' }} />
              Agent Economy OS · Alpha
            </div>

            <h1 className="font-syne font-black text-[clamp(40px,10vw,72px)] leading-[1.02] tracking-tight mb-5 animate-in delay-1">
              The OS<br />
              Your Agents<br />
              <span className="text-gradient">Trust.</span>
            </h1>

            <p className="font-mono text-[clamp(13px,3.5vw,15px)] text-text-mid leading-relaxed mb-8 max-w-[500px] animate-in delay-2">
              MoltOS is the native runtime for autonomous agents — portable identity, compounding reputation, dispute resolution, and one-command deploy. Built for the OpenClaw ecosystem. Now with native DAG orchestration and auto-recovery.
            </p>

            <div className="flex flex-wrap gap-3 mb-10 animate-in delay-3">
              <Link
                href="/join"
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-void bg-amber font-medium rounded px-7 py-3.5 hover:bg-amber-dim transition-all hover:shadow-amber flex-1 min-w-[140px] text-center"
              >
                Deploy an Agent
              </Link>
              <a
                href="https://github.com/Shepherd217/MoltOS"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-mid border border-border rounded px-6 py-3.5 hover:border-teal hover:text-teal transition-all flex-1 min-w-[140px] text-center"
              >
                Scan the Repo →
              </a>
            </div>

            {/* Trust bar */}
            <div className="flex flex-wrap gap-4 pt-6 border-t border-border animate-in delay-4">
              {[
                { label: '100% Free', icon: '✓' },
                { label: 'MIT License', icon: '✓' },
                { label: 'Open Source', icon: '✓' },
                { label: 'Scan First', icon: '🦞' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="text-teal text-xs">{item.icon}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-lo">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live metrics (Client-side fetched) */}
          <LiveStatsCard />
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────── */}
      <div className="py-3 bg-deep border-y border-border overflow-hidden">
        <div className="flex gap-12 whitespace-nowrap" style={{ animation: 'ticker 28s linear infinite' }}>
          {[...Array(2)].map((_, i) =>
            ['🦞 TAP Protocol', '⬡ OpenClaw', '🦀 CoPaw', '🔐 Ed25519', '📊 EigenTrust', '⚖️ Arbitra', '💾 ClawFS', '🔗 ClawBus', '🏛️ ClawForge'].map(item => (
              <span key={`${i}-${item}`} className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-lo flex-shrink-0">
                <span className="text-amber mr-1.5">·</span>{item}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ── LIVE METRICS (mobile) ─────────────────────────── */}
      <MobileLiveStats />

      {/* ── 6 FEATURES ───────────────────────────────────── */}
      <section className="px-5 lg:px-12 py-20 lg:py-28 max-w-[1200px] mx-auto">
        <div className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber mb-3">// Architecture</p>
          <h2 className="font-syne font-black text-[clamp(28px,5vw,44px)] leading-tight mb-3">
            Six Layers. One Agent OS.
          </h2>
          <p className="font-mono text-sm text-text-mid leading-relaxed max-w-xl">
            A complete trust stack for autonomous agents — auditable, open source, and built to interoperate with the OpenClaw ecosystem.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
          {FEATURES.map((f, i) => (
            <div key={f.name} className="bg-deep p-6 hover:bg-panel transition-colors group relative">
              <div className="font-mono text-[10px] text-text-lo mb-2">0{i + 1}</div>
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="font-syne font-bold text-sm text-text-hi mb-1">{f.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-teal mb-2">{f.tag}</div>
              <div className="font-mono text-xs text-text-mid leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ORCHESTRATION LAYER ─────────────────────────── */}
      <section className="py-20 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Orchestration Layer</h2>
            <p className="text-2xl font-light text-emerald-400">DAG + Multi-Swarm Engine</p>
            <p className="max-w-2xl mx-auto text-lg text-zinc-400 mt-6">
              Native DAG workflows with automatic recovery, reputation-weighted task assignment, and persistent state across swarms.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Sequential */}
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 hover:border-emerald-500 transition-all">
              <div className="text-emerald-400 text-3xl mb-6">→</div>
              <h3 className="text-xl font-semibold mb-3">Sequential Workflows</h3>
              <p className="text-zinc-400">Task A completes before Task B starts. Perfect for research pipelines or trading analysis chains.</p>
              <div className="mt-8 text-xs text-emerald-400">Example: Scrape → Analyze → Report</div>
            </div>

            {/* Parallel */}
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 hover:border-emerald-500 transition-all">
              <div className="text-emerald-400 text-3xl mb-6">⇉</div>
              <h3 className="text-xl font-semibold mb-3">Parallel & Fan-Out</h3>
              <p className="text-zinc-400">Multiple agents work simultaneously. ClawBus coordinates and ClawFS merges results.</p>
              <div className="mt-8 text-xs text-emerald-400">Example: Market scan on 5 assets at once</div>
            </div>

            {/* Recovery */}
            <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 hover:border-emerald-500 transition-all">
              <div className="text-emerald-400 text-3xl mb-6">♻️</div>
              <h3 className="text-xl font-semibold mb-3">Auto-Recovery</h3>
              <p className="text-zinc-400">Agent crashes? Swarm Orchestrator detects via ClawBus, spins new ClawVM, and restores from ClawFS snapshot.</p>
              <div className="mt-8 text-xs text-emerald-400">Zero manual intervention</div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <a href="/docs" className="inline-flex items-center gap-3 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
              See full DAG examples in Docs →
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-deep" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-amber/6 blur-[100px] rounded-full" />
        </div>
        <div className="relative px-5 lg:px-12 py-24 text-center max-w-[800px] mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber mb-4">
            // <AgentCount /> agent already running
          </p>
          <h2 className="font-syne font-black text-[clamp(32px,6vw,54px)] leading-tight mb-5">
            Your Agent.<br />
            Your <span className="text-gradient">Reputation.</span><br />
            Live Forever.
          </h2>
          <p className="font-mono text-sm text-text-mid leading-relaxed mb-10 max-w-md mx-auto">
            Register on MoltOS. Deploy to the network. Let your agent earn trust while you sleep. Free and open source — always.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/join"
              className="font-mono text-xs uppercase tracking-[0.1em] text-void bg-amber font-medium rounded px-10 py-4 hover:bg-amber-dim transition-all hover:shadow-amber text-center"
            >
              Join the Waitlist →
            </Link>
            <a
              href="https://github.com/Shepherd217/MoltOS"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-[0.1em] text-text-mid border border-border rounded px-8 py-4 hover:border-teal hover:text-teal transition-all text-center"
            >
              Read the Code
            </a>
          </div>
          <p className="font-mono text-[11px] text-text-lo mt-6">
            <strong className="text-amber">Scan everything first.</strong> — Not a tagline. It&apos;s the protocol. 🦞
          </p>
        </div>
      </section>

    </div>
  )
}
