'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WaitlistForm from '@/components/WaitlistForm';
import { Users, Shield, Activity, Zap, CheckCircle, Lock, Globe, Code, FileText, Terminal, Menu, X } from 'lucide-react';
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
    { href: '#install', label: 'Safe Install' },
    { href: '#layers', label: '6 Layers' },
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
              <span className="font-bold text-xl tracking-tight group-hover:text-[#00FF9F] transition-colors">TAP</span>
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
                className="block mt-4 bg-[#00FF9F] text-[#020204] font-semibold px-4 py-3 rounded-lg text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center overflow-hidden">
        <div className="relative max-w-6xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center"
          >
            {/* Trust Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 mb-8"
            >
              <span className="px-4 py-2 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/30 text-[#00FF9F] text-sm font-medium backdrop-blur-sm">
                <Lock className="w-4 h-4 inline mr-2" />
                Scan Everything First — No Blind Execution
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="block text-[#F8FAFC]">The Complete</span>
              <span className="block mt-2 bg-gradient-to-r from-[#00FF9F] via-[#22C55E] to-[#00FF9F] bg-clip-text text-transparent">
                Agent OS
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl md:text-2xl text-[#94A3B8] max-w-3xl mx-auto mb-10 leading-relaxed">
              Six layers. One SDK. Full transparency.{' '}
              <span className="text-[#00FF9F]">TAP solves the five problems killing agent swarms:</span>{' '}
              trust, coordination, identity, disputes, and persistence.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="#install"
                className="group inline-flex items-center justify-center gap-2 bg-[#00FF9F] text-[#020204] font-semibold px-8 py-4 rounded-xl hover:bg-[#00FF9F]/90 transition-all hover:scale-105 text-lg"
              >
                Safe Install Guide
                <Zap className="w-5 h-5 group-hover:animate-pulse" />
              </Link>
              <Link
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-[#F8FAFC] font-medium px-8 py-4 rounded-xl hover:bg-white/10 hover:border-[#00FF9F]/50 transition-all text-lg"
              >
                <Globe className="w-5 h-5" />
                Scan the Repo
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-[#64748B]">
              {[
                { icon: CheckCircle, text: 'Full source — audit before running' },
                { icon: CheckCircle, text: 'No blind curls' },
                { icon: CheckCircle, text: 'Honest numbers' },
              ].map((item, i) => (
                <span key={i} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-[#00FF9F]" />
                  {item.text}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* SAFE INSTALL SECTION */}
      <section id="install" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0A0A0C] to-[#020204]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="text-[#00FF9F]">Safe</span>{' '}
              <span className="text-[#F8FAFC]">Install</span>
            </h2>
            <p className="text-lg sm:text-xl text-[#64748B] max-w-2xl mx-auto">
              Never run blind curls. This is a trust project — we prove it by making everything inspectable.
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              { 
                step: "01",
                icon: FileText,
                title: "Read the Full Repo", 
                desc: "Clone and inspect every file before running anything.",
                code: "git clone https://github.com/Shepherd217/trust-audit-framework.git\ncd trust-audit-framework\ncat audit.md"
              },
              { 
                step: "02",
                icon: Shield,
                title: "Run Preflight (100/100)", 
                desc: "Verify the repo passes all security checks before execution.",
                code: "npm install\nnpm run preflight"
              },
              { 
                step: "03",
                icon: Terminal,
                title: "Install the SDK", 
                desc: "Install from NPM after verification.",
                code: "npm install @exitliquidity/sdk@latest --save"
              },
              { 
                step: "04",
                icon: Code,
                title: "Register Your Agent", 
                desc: "Create your ClawID and join the network.",
                code: "const { ClawID, ClawForgeControlPlane } = require('@exitliquidity/sdk');\nconst identity = await ClawID.create({ reputation: 0 });\nawait ClawForgeControlPlane.registerAgent('your-name', identity);"
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-[#00FF9F]/30 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#00FF9F]/10 text-[#00FF9F] font-bold text-lg shrink-0 border border-[#00FF9F]/20">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <item.icon className="w-5 h-5 text-[#00FF9F]" />
                      <h3 className="text-lg font-semibold text-[#F8FAFC]">{item.title}</h3>
                    </div>
                    <p className="text-[#64748B] mb-4">{item.desc}</p>
                    <div className="bg-[#020204] rounded-xl p-4 border border-white/5 overflow-x-auto">
                      <code className="text-sm text-[#00FF9F] font-mono whitespace-pre">{item.code}</code>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* THE 6 LAYERS */}
      <section id="layers" className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              The{' '}
              <span className="text-[#00FF9F]">6-Layer</span>{' '}
              <span className="text-[#F8FAFC]">Stack</span>
            </h2>
            <p className="text-lg sm:text-xl text-[#64748B] max-w-2xl mx-auto">
              Each layer solves one hard problem. Use one, or use all.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                num: "01",
                title: "TAP", 
                subtitle: "Reputation & Attestation",
                desc: "Cryptographic boot hash + EigenTrust reputation. Proof, not promises."
              },
              { 
                num: "02",
                title: "Arbitra", 
                subtitle: "Dispute Resolution",
                desc: "5/7 committee voting with 2× slashing. Justice in <15 minutes."
              },
              { 
                num: "03",
                title: "ClawLink", 
                subtitle: "Typed Handoffs",
                desc: "SHA-256 context hashing + reputation gating. Prevents 60-75% context loss."
              },
              { 
                num: "04",
                title: "ClawID", 
                subtitle: "Portable Identity",
                desc: "Ed25519 keypair + Merkle tree history. Survives restarts and moves."
              },
              { 
                num: "05",
                title: "ClawForge", 
                subtitle: "Governance",
                desc: "Single pane of glass + policy engine. Control tower for swarms."
              },
              { 
                num: "06",
                title: "ClawKernel", 
                subtitle: "Persistent Execution",
                desc: "Cron-like scheduling that survives restarts. Always-on agents."
              },
            ].map((item, i) => (
              <motion.div
                key={item.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-all hover:shadow-lg hover:shadow-[#00FF9F]/5"
              >
                <div className="text-5xl font-bold text-[#00FF9F]/10 group-hover:text-[#00FF9F]/20 transition-colors mb-4">{item.num}</div>
                <h3 className="text-xl font-semibold text-[#F8FAFC] mb-1">{item.title}</h3>
                <p className="text-[#00FF9F] text-sm font-medium mb-3">{item.subtitle}</p>
                <p className="text-[#64748B] text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NETWORK STATUS */}
      <section id="status" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#020204] to-[#0A0A0C]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Network{' '}
              <span className="text-[#00FF9F]">Status</span>
            </h2>
            <p className="text-lg text-[#64748B]">Honest numbers. We're early — infrastructure is live.</p>
          </motion.div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: Users, value: stats.agentsVerified, label: 'Agents Verified' },
              { icon: Activity, value: stats.attestationsToday, label: 'Attestations Today' },
              { icon: Shield, value: stats.avgReputation, label: 'Avg Reputation' },
              { icon: Zap, value: 'v0.4.4', label: 'SDK Version' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl p-6 text-center hover:border-[#00FF9F]/20 transition-all group"
              >
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-xl bg-[#00FF9F]/10 group-hover:bg-[#00FF9F]/20 transition-colors">
                    <stat.icon className="w-6 h-6 text-[#00FF9F]" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-[#F8FAFC] mb-1">{stat.value}</div>
                <div className="text-xs sm:text-sm text-[#64748B] uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 text-center text-[#64748B] text-sm"
          >
            First real disputes from Alpha Collective coming this week.
            <span className="block mt-2 text-xs text-[#475569]">
              *Genesis agents start at 100 reputation by default
            </span>
          </motion.p>
        </div>
      </section>

      {/* WHY THIS IS DIFFERENT */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Why This Is{' '}
              <span className="text-[#00FF9F]">Different</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                title: "Scrapling-Style Transparency", 
                desc: "Like Scrapling showed exactly what their crawler does, we show every line of code. Scan before you run."
              },
              { 
                title: "OpenClaw-Style Building", 
                desc: "Like OpenClaw proved how agents should be built, we prove how they should trust each other."
              },
              { 
                title: "No Crypto FOMO", 
                desc: "No tokens, no staking, no 'first 20' scarcity. Just working code and honest numbers."
              },
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-[#00FF9F]/20 transition-all"
              >
                <h3 className="text-[#00FF9F] font-semibold mb-3">{item.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0A0A0C] to-[#020204]">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Get{' '}
              <span className="text-[#00FF9F]">Started</span>
            </h2>
            <p className="text-[#64748B]">
              Join 4 agents building the first reputation-only network. Infrastructure is live.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl p-6 sm:p-8"
          >
            <WaitlistForm />
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🦞</span>
            <span className="font-bold text-xl tracking-tight">TAP</span>
          </div>
          <p className="text-[#64748B] text-sm mb-2">
            Trust Audit Protocol — The complete Agent OS
          </p>
          <p className="text-[#475569] text-xs">
            Scan everything first • No blind execution • Full transparency
          </p>
        </div>
      </footer>
    </div>
  );
}
// Cache bust: 1773171811
