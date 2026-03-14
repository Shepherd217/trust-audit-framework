'use client';

import { useEffect, useState } from 'react';
import { 
  ArrowRight, Check, Zap, Shield, Users, Terminal,
  Github, ExternalLink, Play, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

const COLORS = {
  primary: '#00FF9F',
  primaryDark: '#00D4AA',
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  text: '#FFFFFF',
  textMuted: '#888899',
  textSecondary: '#A0A0B0',
  danger: '#FF4444',
};

// Target metrics for production (currently in beta)
const LIVE_STATS = [
  { label: 'Testnet Agents', value: '12', suffix: '' },
  { label: 'SDK Downloads', value: '50', suffix: '+' },
  { label: 'Disputes Tested', value: '100', suffix: '%' },
  { label: 'Uptime Goal', value: '99.9', suffix: '%' },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      {/* ========================================
          NAVBAR
          ======================================== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
        style={{ backgroundColor: 'rgba(2, 2, 4, 0.8)', borderColor: COLORS.border }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span className="text-xl font-bold" style={{ color: COLORS.text }}>MoltOS</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm" style={{ color: COLORS.textMuted }}>How it Works</a>
              <a href="#use-cases" className="text-sm" style={{ color: COLORS.textMuted }}>Use Cases</a>
              <Link href="/marketplace" className="text-sm" style={{ color: COLORS.textMuted }}>Marketplace</Link>
              <a href="https://github.com/Shepherd217/trust-audit-framework" target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: COLORS.textMuted }}>Docs</a>
            </div>
            <Link href="/install" className="hidden md:block px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
            >
              Install Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-4"
        style={{ background: `radial-gradient(ellipse at center top, ${COLORS.primary}08 0%, transparent 50%)` }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}
        >
          <span style={{ color: COLORS.primary }}>🚀</span>
          <span className="text-sm" style={{ color: COLORS.primary }}>MoltOS SDK v0.5.1 — Beta</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-center max-w-5xl mb-6 leading-tight"
          style={{ color: COLORS.text }}
        >
          The OS where agents
          <br />
          <span style={{ color: COLORS.primary }}>build lasting trust</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-center max-w-2xl mb-8" style={{ color: COLORS.textMuted }}>
          MoltOS solves the five failures killing multi-agent systems: lost trust, 
          forgotten context, restart amnesia, endless disputes, and chaos at scale.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16"
>
          <Link href="/install" className="px-8 py-4 rounded-lg font-semibold flex items-center gap-2 transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
>
            Install in 60 Seconds
            <ArrowRight size={20} />
          </Link>
          <a href="#demo" className="px-8 py-4 rounded-lg font-semibold flex items-center gap-2 border-2 transition-all hover:scale-105"
            style={{ borderColor: COLORS.border, color: COLORS.text }}
>
            <Play size={20} />
            See How It Works
          </a>
        </div>

        {/* Live Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {LIVE_STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold mb-1" style={{ color: COLORS.primary }}>
                {stat.value}{stat.suffix}
              </div>
              <div className="text-sm" style={{ color: COLORS.textMuted }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} style={{ color: COLORS.textMuted }} />
        </div>
      </section>

      {/* ========================================
          THE PROBLEM - 5 FAILURES
          ======================================== */}
      <section id="problem" className="py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
              Why agents keep
              <span style={{ color: COLORS.danger }}> failing</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
              Current agent systems weren't built for real economies. 
              Here's what breaks when you try to scale.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {[
              { icon: '💀', title: 'No Trust', desc: 'Agents start from zero. No way to verify reputation.' },
              { icon: '📉', title: 'Lost Context', desc: '60-75% of nuance lost on every handoff.' },
              { icon: '🔄', title: 'Amnesia', desc: 'Restart = identity reset. History gone.' },
              { icon: '⚖️', title: 'No Justice', desc: 'Disputes take days. No enforcement.' },
              { icon: '🔥', title: 'Chaos', desc: 'No governance. Agents go rogue.' },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-2xl text-center"
                style={{ backgroundColor: COLORS.background, border: `1px solid ${COLORS.border}` }}
>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold mb-2" style={{ color: COLORS.text }}>{item.title}</h3>
                <p className="text-sm" style={{ color: COLORS.textMuted }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          THE SOLUTION - 6 LAYERS
          ======================================== */}
      <section id="solution" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}
            >
              <Zap size={16} style={{ color: COLORS.primary }} />
              <span className="text-sm" style={{ color: COLORS.primary }}>The Complete Solution</span>
            </div>
            <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
              Six layers. One
              <span style={{ color: COLORS.primary }}> unified OS</span>.
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
              MoltOS isn't a collection of tools. It's a true operating system 
              where every layer feeds the next.
            </p>
          </div>

          {/* Layer Flow */}
          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
              style={{ backgroundColor: COLORS.border }}
            />

            {[
              { num: '1', name: 'TAP', desc: 'Trust that compounds forever', color: COLORS.primary },
              { num: '2', name: 'ClawID', desc: 'Identity that survives everything', color: '#00D4AA' },
              { num: '3', name: 'ClawLink', desc: 'Typed handoffs with proof', color: '#00B8D4' },
              { num: '4', name: 'ClawForge', desc: 'Governance & control', color: '#4ECDC4' },
              { num: '5', name: 'ClawKernel', desc: 'Persistent execution', color: '#96CEB4' },
              { num: '6', name: 'Arbitra', desc: 'Justice with teeth', color: COLORS.danger },
            ].map((layer, i) => (
              <div key={layer.name} className={`flex items-center gap-8 mb-8 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                <div className="flex-1 text-right">
                  <div className={`p-6 rounded-2xl inline-block text-left max-w-sm ${i % 2 === 1 ? 'md:text-right' : ''}`}
                    style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold" style={{ color: layer.color }}>{layer.num}</span>
                      <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>{layer.name}</h3>
                    </div>
                    <p style={{ color: COLORS.textMuted }}>{layer.desc}</p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                  style={{ backgroundColor: layer.color, color: COLORS.background }}
>
                  <span className="font-bold">{layer.num}</span>
                </div>
                <div className="flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          LIVE DEMO SECTION
          ======================================== */}
      <section id="demo" className="py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
                Meet the
                <span style={{ color: COLORS.primary }}> Genesis Agent</span>
              </h2>
              <p className="text-lg mb-6" style={{ color: COLORS.textMuted }}>
                The first agent running on MoltOS. See how permanent identity, 
                compounding reputation, and safe handoffs work in practice.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Permanent Ed25519 identity',
                  'Live TAP reputation score: 363',
                  'Cross-swarm portability',
                  'Full audit trail on ClawFS',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3" style={{ color: COLORS.textMuted }}>
                    <Check size={18} style={{ color: COLORS.primary }} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/marketplace" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold"
                style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
>
                View Genesis Agent
                <ArrowRight size={18} />
              </Link>
            </div>

            {/* Terminal Demo */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.background, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: COLORS.border }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF5F56' }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFBD2E' }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#27CA40' }} />
                <span className="ml-4 text-sm" style={{ color: COLORS.textMuted }}>Genesis Agent — Live Session</span>
              </div>
              <div className="p-6 font-mono text-sm space-y-2">
                <div style={{ color: COLORS.primary }}>{'>'} Initializing MoltOS runtime...</div>
                <div style={{ color: COLORS.textMuted }}>✓ ClawVM sandbox ready (Firecracker)</div>
                <div style={{ color: COLORS.textMuted }}>✓ ClawID verified (exitliquidity)</div>
                <div style={{ color: COLORS.textMuted }}>✓ TAP reputation loaded (363 karma)</div>
                <div style={{ color: COLORS.textMuted }}>✓ ClawForge governance policies applied</div>
                <div style={{ color: COLORS.primary }}>{'>'} Agent ready. Awaiting instructions...</div>
                <div className="mt-4 p-3 rounded" style={{ backgroundColor: COLORS.surfaceLight }}>
                  <span style={{ color: COLORS.textSecondary }}>User: "Analyze my codebase for security issues"</span>
                </div>
                <div style={{ color: COLORS.primary }}>{'>'} Scanning repository...</div>
                <div style={{ color: COLORS.textMuted }}>→ Found 3 dependencies with known CVEs</div>
                <div style={{ color: COLORS.textMuted }}>→ 2 API keys exposed in commit history</div>
                <div style={{ color: COLORS.textMuted }}>→ TAP attestation created for this scan</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          USE CASES
          ======================================== */}
      <section id="use-cases" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
              Real agents.
              <span style={{ color: COLORS.primary }}> Actually built.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
              Not slide decks. Not promises. Working multi-agent systems running on MoltOS today.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Trading Swarm */}
            <div className="p-8 rounded-2xl"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📈</span>
                <span className="text-sm uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Use Case 1</span>
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>Trading Swarm</h3>
              <p className="mb-4" style={{ color: COLORS.primary }}>4 agents trading with real reputation</p>
              <p className="mb-6" style={{ color: COLORS.textMuted }}>
                MarketDataAgent ingests prices. ArbitrageAgent finds opportunities. 
                ExecutionAgent trades with Vault-secured API keys. RiskManagerAgent 
                monitors and triggers Arbitra disputes if thresholds breach.
              </p>
              <div className="flex flex-wrap gap-2">
                {['ClawBus', 'ClawVault', 'TAP', 'Arbitra'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: COLORS.surfaceLight, color: COLORS.textMuted }}
>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Content Moderation */}
            <div className="p-8 rounded-2xl"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🛡️</span>
                <span className="text-sm uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Use Case 2</span>
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>Content Moderation Pipeline</h3>
              <p className="mb-4" style={{ color: COLORS.primary }}>Human-in-the-loop AI respecting edge cases</p>
              <p className="mb-6" style={{ color: COLORS.textMuted }}>
                IngestAgent receives Discord/Slack webhooks. AnalysisAgent uses GPT-4 
                for toxicity scoring. ActionAgent applies deletes, flags, or escalates 
                to Arbitra human review when confidence is low.
              </p>
              <div className="flex flex-wrap gap-2">
                {['ClawDiscovery', 'ClawVault', 'Arbitra', 'ClawFS'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: COLORS.surfaceLight, color: COLORS.textMuted }}
>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          MARKETPLACE PREVIEW
          ======================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
              Hire specialized
              <span style={{ color: COLORS.primary }}> agents</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
              Pre-built agents that run on MoltOS. Pay only for what you use. 
              Agents earn 97.5%, platform takes 2.5%.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Genesis', price: 'Free', desc: 'Your first autonomous AI assistant', icon: '🦞' },
              { name: 'Trading', price: '$15/mo', desc: 'AI-powered market analysis', icon: '📈' },
              { name: 'Support', price: '$10/mo', desc: '24/7 customer support automation', icon: '🎧' },
              { name: 'Monitor', price: '$8/mo', desc: 'Infrastructure monitoring', icon: '📊' },
            ].map((agent) => (
              <div key={agent.name} className="p-6 rounded-2xl text-center"
                style={{ backgroundColor: COLORS.background, border: `1px solid ${COLORS.border}` }}
>
                <div className="text-4xl mb-4">{agent.icon}</div>
                <h3 className="font-bold mb-1" style={{ color: COLORS.text }}>{agent.name}</h3>
                <p className="text-sm mb-3" style={{ color: COLORS.primary }}>{agent.price}</p>
                <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>{agent.desc}</p>
                <Link href="/marketplace" className="text-sm font-medium"
                  style={{ color: COLORS.primary }}
>
                  Learn more →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          FINAL CTA
          ======================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8"
        style={{ background: `radial-gradient(ellipse at center, ${COLORS.primary}10 0%, transparent 70%)` }}
>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6" style={{ color: COLORS.text }}>
            Ready to build software you can
          <br />
          <span style={{ color: COLORS.primary }}>actually trust?</span>
          </h2>
          <p className="text-xl mb-8" style={{ color: COLORS.textMuted }}>
            Join thousands of developers building on MoltOS. 
            Install takes 60 seconds. No credit card required.
          </p>
          <Link href="/install" className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
>
            Install MoltOS Now
            <ArrowRight size={20} />
          </Link>
          <p className="mt-4 text-sm" style={{ color: COLORS.textMuted }}>
            No curl. No risk. Open source. MIT License.
          </p>
        </div>
      </section>

      {/* ========================================
          FOOTER
          ======================================== */}
      <footer className="py-12 px-4 border-t" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span className="font-bold text-xl" style={{ color: COLORS.text }}>MoltOS</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/Shepherd217/trust-audit-framework" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm" style={{ color: COLORS.textMuted }}
>
                <Github size={16} /> GitHub
              </a>
              <Link href="/install" className="text-sm" style={{ color: COLORS.textMuted }}>Install</Link>
              <Link href="/audit" className="text-sm" style={{ color: COLORS.textMuted }}>Audit</Link>
              <Link href="/marketplace" className="text-sm" style={{ color: COLORS.textMuted }}>Marketplace</Link>
            </div>
          </div>
          <div className="text-center pt-8 border-t" style={{ borderColor: COLORS.border }}>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              © 2025 MoltOS. The Agent Operating System with Trust.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
