'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WaitlistForm from '@/components/WaitlistForm';
import { Users, Shield, Activity, Zap, CheckCircle, Lock, Globe, Code, FileText, Terminal, Menu, X, Cpu, Server, Cloud, Database, Eye, Bug } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [stats, setStats] = useState({
    agentsVerified: 4,
    attestationsToday: 0,
    avgReputation: 97,
    openClawVerifications: 0,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            {/* Logo */}
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

            {/* Desktop Nav */}
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
                href="#install"
                className="ml-4 bg-[#00FF9F] text-[#020204] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#00FF9F]/90 transition-all hover:scale-105 text-sm"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-[#94A3B8] hover:text-[#00FF9F]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
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
                href="#install"
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
            {/* Version Badge */}
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="#install"
                className="inline-flex items-center justify-center gap-2 bg-[#00FF9F] text-[#020204] font-semibold px-8 py-4 rounded-xl hover:bg-[#00FF9F]/90 transition-all hover:scale-105 text-lg"
              >
                <Terminal className="w-5 h-5" />
                Install in 60 Seconds
              </Link>
              <Link 
                href="#architecture"
                className="inline-flex items-center justify-center gap-2 bg-white/5 text-[#F8FAFC] font-medium px-8 py-4 rounded-xl hover:bg-white/10 transition-all border border-white/10 text-lg"
              >
                Explore Architecture
              </Link>
            </div>

            {/* Safe Install Command */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 max-w-xl mx-auto"
            >
              <div className="bg-[#0A0A0F] border border-white/10 rounded-xl p-4 font-mono text-sm text-left overflow-x-auto">
                <div className="flex items-center gap-2 mb-2 text-[#94A3B8] text-xs">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span>verified install</span>
                </div>
                <span className="text-[#00FF9F]">$</span> <span className="text-[#F8FAFC]">npm install -g @moltos/cli</span>
              </div>
              <p className="text-xs text-[#64748B] mt-2">
                Or download from{' '}
                <Link href="https://github.com/Shepherd217/clawos/releases" className="text-[#00FF9F] hover:underline">
                  GitHub Releases
                </Link>{' '}
                (SHA256 verified)
              </p>
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
              Eight core subsystems. One unified platform. Deploy anywhere in minutes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Native Runtime */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Native Runtime</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> MoltVM execution</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> WASM-based sandbox</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> &lt;300ms boot time</li>
              </ul>
            </motion.div>

            {/* Card 2: Secure Sandbox */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Sandbox</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Firecracker microVMs</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Resource quotas</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Auto-kill on breach</li>
              </ul>
            </motion.div>

            {/* Card 3: Deploy Anywhere */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Deploy Anywhere</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Fly.io integration</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Railway support</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Docker & Kubernetes</li>
              </ul>
            </motion.div>

            {/* Card 4: Persist State */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Persist State</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> MoltFS filesystem</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Merkle-ized storage</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Cross-region replicate</li>
              </ul>
            </motion.div>

            {/* Card 5: Multi Language */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Code className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Multi Language</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Python SDK</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Go SDK</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Node.js & OpenClaw</li>
              </ul>
            </motion.div>

            {/* Card 6: Observe Everything */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Eye className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Observe Everything</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Prometheus metrics</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Live TUI dashboard</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Real-time alerts</li>
              </ul>
            </motion.div>

            {/* Card 7: Swarm Orchestrate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Server className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Swarm Orchestrate</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Leader election</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Auto-recovery</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> 100+ agent clusters</li>
              </ul>
            </motion.div>

            {/* Card 8: Cloud Deploy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Cloud className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Cloud Deploy</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> One-command deploy</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Auto-scale</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Global edge + SSL</li>
              </ul>
            </motion.div>

            {/* Card 9: Debug Toolkit */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:bg-white/[0.07]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Bug className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Debug Toolkit</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Live log streaming</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> Distributed traces</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00FF9F]" /> State inspector</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section id="install" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-[#00FF9F]/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Install MoltOS</h2>
            <p className="text-[#94A3B8] text-lg">
              One command. 60 seconds. Production-ready agents.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-[#0A0A0F] border border-white/10 rounded-2xl p-8"
          >
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#00FF9F] font-semibold">1</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-2">Install the CLI</h4>
                  <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
                    <span className="text-[#00FF9F]">$</span> npm install -g @moltos/cli
                  </div>
                  <p className="text-xs text-[#64748B] mt-2">
                    Or{' '}
                    <Link href="https://github.com/Shepherd217/clawos/releases" className="text-[#00FF9F] hover:underline">
                      download verified binary
                    </Link>{' '}
                    from GitHub Releases
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#00FF9F] font-semibold">2</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-2">Initialize your project</h4>
                  <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
                    <span className="text-[#00FF9F]">$</span> moltos init my-agent
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#00FF9F] font-semibold">3</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-2">Deploy</h4>
                  <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
                    <span className="text-[#00FF9F]">$</span> moltos deploy
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-[#94A3B8] text-sm">
                Join the waitlist for early access and enterprise features.
              </p>
              <div className="mt-4 max-w-md mx-auto">
                <WaitlistForm />
              </div>
            </div>
          </motion.div>
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
            <Link href="#" className="hover:text-[#00FF9F] transition-colors">Documentation</Link>
            <Link href="#" className="hover:text-[#00FF9F] transition-colors">GitHub</Link>
            <Link href="#" className="hover:text-[#00FF9F] transition-colors">Discord</Link>
          </div>
          <p className="text-sm text-[#94A3B8]">
            © 2025 MoltOS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
