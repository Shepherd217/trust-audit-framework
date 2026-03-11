'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WaitlistForm from '@/components/WaitlistForm';
import { CheckCircle, Lock, Globe, Code, Terminal, Menu, X, Cpu, Server, Cloud, Database, Eye, Bug, Copy, Check } from 'lucide-react';
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
    { href: '#install', label: 'Install' },
    { href: '#architecture', label: 'Architecture' },
    { href: '#status', label: 'Network' },
  ];

  const installPrompt = `Go to https://moltos.org/skill.md and install the official MoltOS skill. Run preflight first and show me exactly what it will do.`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(installPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020204] text-[#F8FAFC] selection:bg-[#00FF9F]/30">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#00FF9F]/5 via-transparent to-[#22C55E]/5 pointer-events-none" />
      
      {/* Glassmorphism Orbs */}
      <div className="fixed top-20 left-10 w-72 h-72 bg-[#00FF9F]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-[#22C55E]/10 rounded-full blur-[150px] pointer-events-none" />

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

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/20 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-[#00FF9F] animate-pulse" />
              <span className="text-sm text-[#00FF9F] font-medium">MoltOS v1.0.0 — Now in Production</span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              The Complete{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF9F] to-[#22C55E]">
                Agent Operating System
              </span>
            </h1>
            
            <p className="text-xl text-[#94A3B8] mb-10 max-w-2xl mx-auto leading-relaxed">
              Everything you need to build, deploy, and manage AI agents at scale. 
              Runtime, sandbox, storage, networking, and observability — in one unified platform.
            </p>

            {/* INSTALL BUTTON WITH CLIPBOARD */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center justify-center gap-2 bg-[#00FF9F] text-[#020204] font-semibold px-8 py-4 rounded-xl hover:bg-[#00FF9F]/90 transition-all hover:scale-105 text-lg"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied to clipboard!' : 'Install MoltOS in 60 seconds (safe & transparent)'}
              </button>
              
              <p className="text-sm text-[#64748B]">
                Click to copy install prompt • No curl • Full transparency
              </p>
            </div>

            {/* Prompt Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 max-w-2xl mx-auto"
            >
              <div className="bg-[#0A0A0F] border border-white/10 rounded-xl p-4 text-left">
                <div className="flex items-center gap-2 mb-3 text-[#94A3B8] text-xs">
                  <Lock className="w-3 h-3 text-[#00FF9F]" />
                  <span>This will be copied to your clipboard:</span>
                </div>
                <p className="text-sm text-[#F8FAFC] font-mono bg-black/30 p-3 rounded-lg">
                  {installPrompt}
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* COMPLETE OS ARCHITECTURE */}
      <section id="architecture" className="relative py-24 px-4 sm:px-6 lg:px-8">
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
            {[
              { icon: Cpu, title: 'Native Runtime', features: ['MoltVM execution', 'WASM-based sandbox', '<300ms boot time'] },
              { icon: Lock, title: 'Secure Sandbox', features: ['Firecracker microVMs', 'Resource quotas', 'Auto-kill on breach'] },
              { icon: Globe, title: 'Deploy Anywhere', features: ['Fly.io integration', 'Railway support', 'Docker & Kubernetes'] },
              { icon: Database, title: 'Persist State', features: ['MoltFS filesystem', 'Merkle-ized storage', 'Cross-region replicate'] },
              { icon: Code, title: 'Multi Language', features: ['Python SDK', 'Go SDK', 'Node.js & OpenClaw'] },
              { icon: Eye, title: 'Observe Everything', features: ['Prometheus metrics', 'Live TUI dashboard', 'Real-time alerts'] },
              { icon: Server, title: 'Swarm Orchestrate', features: ['Leader election', 'Auto-recovery', '100+ agent clusters'] },
              { icon: Cloud, title: 'Cloud Deploy', features: ['One-command deploy', 'Auto-scale', 'Global edge + SSL'] },
              { icon: Bug, title: 'Debug Toolkit', features: ['Live log streaming', 'Distributed traces', 'State inspector'] },
            ].map((card, i) => (
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
            <Link href="https://github.com/Shepherd217/clawos" className="hover:text-[#00FF9F] transition-colors">GitHub</Link>
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
