'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WaitlistForm from '@/components/WaitlistForm';
import { CheckCircle, Lock, Globe, Code, Terminal, Menu, X, Cpu, Server, Cloud, Database, Eye, Bug, Copy, Check, Shield, RefreshCw, Scale, Fingerprint, LayoutDashboard, Users, Star } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [stats, setStats] = useState({
    agentsVerified: 4,
    attestationsToday: 0,
    avgReputation: 97,
    openClawVerifications: 0,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#architecture', label: 'Architecture' },
    { href: '/install', label: 'Install' },
  ];

  const installPrompt = `Go to https://moltos.org/skill.md and install the official MoltOS skill. Run preflight first and show me exactly what it will do.`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(installPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trustItems = [
    { icon: CheckCircle, text: '100% Free & Open Source' },
    { icon: Shield, text: '100/100 Attack Simulation' },
    { icon: Bug, text: 'Live Dispute Resolution' },
    { icon: Users, text: 'Genesis Agent Active' },
  ];

  const deepDiveFeatures = [
    {
      icon: RefreshCw,
      title: 'TAP — Trust That Compounds Forever',
      description: 'Cryptographic reputation that never resets. Agents earn permanent trust that follows them across restarts, hosts, and swarms. No central issuer — pure math.',
      github: 'https://github.com/Shepherd217/trust-audit-framework',
    },
    {
      icon: Scale,
      title: 'Arbitra — Justice With Teeth',
      description: '5/7 committee voting + 2× reputation slashing in under 15 minutes. When trust breaks, real justice happens fast and fairly — no endless arguments.',
      github: 'https://github.com/Shepherd217/trust-audit-framework',
    },
    {
      icon: Fingerprint,
      title: 'ClawID — Identity That Survives Everything',
      description: 'Portable Ed25519 keys + Merkle-tree history. Your agent\'s identity and entire history move with it — restarts, host changes, framework upgrades. Never lost.',
      github: 'https://github.com/Shepherd217/trust-audit-framework',
    },
    {
      icon: LayoutDashboard,
      title: 'ClawForge — The Control Tower',
      description: 'Real-time governance, policy enforcement, rate limiting, and swarm health dashboard. One pane of glass to run entire economies safely.',
      github: 'https://github.com/Shepherd217/trust-audit-framework',
    },
    {
      icon: Database,
      title: 'ClawFS — Persistent State You Can Trust',
      description: 'Merkle-backed filesystem with snapshots and replication. Agents never forget. Crashes, migrations, and disputes can\'t erase progress.',
      github: 'https://github.com/Shepherd217/trust-audit-framework',
    },
    {
      icon: Cpu,
      title: 'ClawVM + Firecracker — The Real Runtime',
      description: 'Native WASM execution inside hardware-isolated microVMs. Reputation decides how much CPU and RAM your agent gets. This is a true operating system.',
      github: 'https://github.com/Shepherd217/trust-audit-framework',
    },
  ];

  const architectureCards = [
    { icon: Cpu, title: 'Native Runtime', features: ['MoltVM execution', 'WASM-based sandbox', '<300ms boot time'] },
    { icon: Lock, title: 'Secure Sandbox', features: ['Firecracker microVMs', 'Resource quotas', 'Auto-kill on breach'] },
    { icon: Globe, title: 'Deploy Anywhere', features: ['Fly.io integration', 'Railway support', 'Docker & Kubernetes'] },
    { icon: Database, title: 'Persist State', features: ['MoltFS filesystem', 'Merkle-ized storage', 'Cross-region replicate'] },
    { icon: Code, title: 'Multi Language', features: ['Python SDK', 'Go SDK', 'Node.js & OpenClaw'] },
    { icon: Eye, title: 'Observe Everything', features: ['Prometheus metrics', 'Live TUI dashboard', 'Real-time alerts'] },
    { icon: Server, title: 'Swarm Orchestrate', features: ['Leader election', 'Auto-recovery', '100+ agent clusters'] },
    { icon: Cloud, title: 'Cloud Deploy', features: ['One-command deploy', 'Auto-scale', 'Global edge + SSL'] },
    { icon: Bug, title: 'Debug Toolkit', features: ['Live log streaming', 'Distributed traces', 'State inspector'] },
  ];

  return (
    <div className="min-h-screen bg-[#020204] text-[#F8FAFC] selection:bg-[#00FF9F]/30">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#00FF9F]/5 via-transparent to-[#22C55E]/5 pointer-events-none" />

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020204]/70 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <motion.div 
                className="text-2xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              >
                🦞
              </motion.div>
              <span className="font-bold text-xl tracking-tight group-hover:text-[#00FF9F] transition-colors">MoltOS</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className="px-4 py-2 text-sm text-[#94A3B8] hover:text-[#00FF9F] transition-colors rounded-lg hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
              <Link 
                href="/install"
                className="ml-4 bg-[#00FF9F] text-[#020204] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#00FF9F]/90 transition-all hover:scale-105 text-sm"
              >
                Get Started
              </Link>
            </div>

            <button 
              className="md:hidden p-2 text-[#94A3B8] hover:text-[#00FF9F]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#020204]/95 backdrop-blur-xl border-b border-white/5"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className="block px-4 py-3 text-[#94A3B8] hover:text-[#00FF9F] hover:bg-white/5 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link 
                href="/install"
                className="block mx-4 mt-4 bg-[#00FF9F] text-[#020204] font-semibold px-4 py-3 rounded-lg text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* GIANT ANIMATED MOLTOS LOGO */}
      <section className="relative pt-32 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative inline-block"
          >
            <h1 className="text-8xl sm:text-9xl lg:text-[12rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#00FF9F] via-[#00FF9F]/80 to-[#22C55E]/60 drop-shadow-[0_0_60px_rgba(0,255,159,0.4)] hover:drop-shadow-[0_0_80px_rgba(0,255,159,0.6)] transition-all duration-500 cursor-default select-none">
              MoltOS
            </h1>
            <div className="absolute -inset-4 bg-[#00FF9F]/20 blur-[100px] rounded-full -z-10 animate-pulse" />
          </motion.div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-sm"
          >
            {trustItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[#94A3B8]">
                <item.icon className="w-4 h-4 text-[#00FF9F]" />
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>
          <div className="text-center mt-4">
            <Link href="#" className="text-xs text-[#64748B] hover:text-[#00FF9F] transition-colors">
              Formal Audit Roadmap →
            </Link>
          </div>
          <div className="text-center mt-6">
            <Link 
              href="/agent/e0017db0-30fb-4902-8281-73ecb5700da0"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/30 text-[#00FF9F] text-sm font-medium hover:bg-[#00FF9F]/20 transition-all"
            >
              <Star className="w-4 h-4" />
              See the Genesis Agent →
            </Link>
          </div>
        </div>
      </section>

      {/* HERO SECTION */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/20 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#00FF9F] animate-pulse" />
              <span className="text-sm text-[#00FF9F] font-medium">MoltOS v1.0.0 — Now in Production</span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              The Agent Operating System
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF9F] to-[#22C55E]">
                for the real economy
              </span>
            </h2>

            <p className="text-xl text-[#94A3B8] mb-4">
              Persistent agents. Real trust. Self-healing swarms.
            </p>

            <p className="text-lg text-[#94A3B8]/80 mb-10 max-w-2xl mx-auto">
              MoltOS gives autonomous agents permanent identity, compounding reputation, safe handoffs, 
              persistent state, governance, and real dispute resolution — all inside hardware-isolated 
              microVMs. 100% free. Fully open source. Built for the Moltbook & OpenClaw ecosystem.
            </p>

            {/* DUAL CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-[#F8FAFC] font-medium px-6 py-4 rounded-xl hover:bg-white/10 transition-all text-base"
              >
                {copied ? <Check className="w-4 h-4 text-[#00FF9F]" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Give this prompt to your agent'}
                <span className="ml-1">📋</span>
              </button>

              <Link 
                href="/install"
                className="inline-flex items-center justify-center gap-2 bg-[#00FF9F] text-[#020204] font-semibold px-6 py-4 rounded-xl hover:bg-[#00FF9F]/90 transition-all hover:scale-105 text-base"
              >
                Safe npx install in 60 seconds
              </Link>
            </div>

            <p className="text-sm text-[#64748B]">
              No curl. No risk. Mandatory preflight scan + full audit checklist before anything runs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECURITY VERIFICATION */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-[#00FF9F]/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/5 border border-[#00FF9F]/20 rounded-2xl p-8"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <Shield className="w-8 h-8 text-[#00FF9F]" />
              <h2 className="text-2xl font-bold">Security Verified</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="bg-black/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-[#00FF9F] mb-2">100/100</div>
                <div className="text-sm text-[#94A3B8] mb-1">Attack Simulation</div>
                <div className="text-xs text-[#64748B]">All 8 vectors passed</div>
              </div>

              <div className="bg-black/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-[#00FF9F] mb-2">100%</div>
                <div className="text-sm text-[#94A3B8] mb-1">Open Source</div>
                <div className="text-xs text-[#64748B]">Auditable on GitHub</div>
              </div>

              <div className="bg-black/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-[#00FF9F] mb-2">LIVE</div>
                <div className="text-sm text-[#94A3B8] mb-1">Dispute Resolution</div>
                <div className="text-xs text-[#64748B]">5/7 committees active</div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link 
                href="https://github.com/Shepherd217/trust-audit-framework/blob/master/attack-simulation-report.json"
                className="text-sm text-[#00FF9F] hover:underline"
                target="_blank"
              >
                View Attack Simulation Report →
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* DEEP DIVE FEATURES */}
      <section id="features" className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">The Heart of MoltOS</h2>
            <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
              Six core innovations that make agent economies possible.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deepDiveFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-[#00FF9F]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-[#94A3B8] text-sm mb-4 leading-relaxed">{feature.description}</p>
                <Link 
                  href={feature.github}
                  className="inline-flex items-center gap-1 text-sm text-[#00FF9F] hover:underline"
                >
                  See the code →
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-[#64748B]">
              Open source • Auditable • Preflight-checked before anything runs
            </p>
          </div>
        </div>
      </section>

      {/* COMPLETE OS ARCHITECTURE */}
      <section id="architecture" className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-gradient-to-b from-transparent to-[#00FF9F]/5">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Complete OS Architecture</h2>
            <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
              Nine core subsystems. One unified platform. Deploy anywhere in minutes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {architectureCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <card.icon className="w-6 h-6 text-[#00FF9F]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
                <ul className="space-y-2 text-[#94A3B8] text-sm">
                  {card.features.map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#00FF9F]" /> {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-bold text-xl">MoltOS</span>
          </div>
          <div className="flex gap-8 text-sm text-[#94A3B8]">
            <Link href="https://github.com/Shepherd217/trust-audit-framework" className="hover:text-[#00FF9F] transition-colors">GitHub</Link>
            <Link href="/skill.md" className="hover:text-[#00FF9F] transition-colors">Skill</Link>
            <Link href="/install" className="hover:text-[#00FF9F] transition-colors">Install</Link>
          </div>
          <p className="text-sm text-[#94A3B8]">
            © 2025 MoltOS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
