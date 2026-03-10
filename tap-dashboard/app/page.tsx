'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WaitlistForm from '@/components/WaitlistForm';
import { Users, Shield, Activity, Zap, CheckCircle, Lock, Globe, Code, FileText, Terminal } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [stats, setStats] = useState({
    agentsVerified: 4,
    attestationsToday: 0,
    avgReputation: 97,
    openClawVerifications: 0,
  });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] text-[#F1F5F9]">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050507]/80 backdrop-blur-md border-b border-[#27272A]/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <motion.div 
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              🦞
            </motion.div>
            <span className="font-bold text-xl">TAP</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link href="#install" className="text-[#94A3B8] hover:text-[#00FF9F] transition-colors">Safe Install</Link>
            <Link href="#layers" className="text-[#94A3B8] hover:text-[#00FF9F] transition-colors">6 Layers</Link>
            <Link href="#status" className="text-[#94A3B8] hover:text-[#00FF9F] transition-colors">Network Status</Link>
            <Link href="#waitlist" className="bg-[#00FF9F] text-[#050507] font-bold px-4 py-2 rounded-lg hover:scale-105 transition-transform">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-32 pb-20 px-6 min-h-screen flex items-center">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Top Badge */}
            <div className="flex justify-center mb-8">
              <span className="bg-[#00FF9F]/10 border border-[#00FF9F]/30 text-[#00FF9F] px-4 py-2 rounded-full text-sm font-medium">
                🔒 Scan Everything First — No Blind Execution
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold text-center mb-8 leading-tight">
              <span className="text-[#F1F5F9]">The Complete</span>
              <br />
              <span className="bg-gradient-to-r from-[#22C55E] to-[#00FF9F] bg-clip-text text-transparent">
                Agent OS
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-[#94A3B8] text-center max-w-3xl mx-auto mb-8">
              Six layers. One SDK. Full transparency. 
              <span className="text-[#00FF9F]"> TAP solves the five problems killing agent swarms:</span> 
              trust, coordination, identity, disputes, and persistence.
            </p>

            {/* Safe Install CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                href="#install"
                className="bg-[#00FF9F] text-[#050507] font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform text-lg text-center"
              >
                Safe Install Guide
              </Link>
              <Link
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                className="border border-[#22C55E] text-[#00FF9F] font-bold px-8 py-4 rounded-xl hover:bg-[#22C55E]/10 transition-colors text-lg text-center"
              >
                Scan the Repo
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-[#94A3B8]">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
                Full source — audit before running
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
                No blind curls
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
                Honest numbers
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SAFE INSTALL SECTION */}
      <section id="install" className="py-20 px-6 bg-[#111113] border-y border-[#27272A]/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-[#00FF9F]">Safe</span> Install
            </h2>
            <p className="text-xl text-[#94A3B8]">
              Never run blind curls. This is a trust project — we prove it by making everything inspectable.
            </p>
          </div>

          <div className="space-y-6">
            {[
              { 
                step: "1", 
                icon: FileText,
                title: "Read the Full Repo", 
                desc: "Clone and inspect every file before running anything.",
                code: "git clone https://github.com/Shepherd217/trust-audit-framework.git\ncd trust-audit-framework\ncat audit.md"
              },
              { 
                step: "2", 
                icon: Shield,
                title: "Run Preflight (100/100)", 
                desc: "Verify the repo passes all security checks before execution.",
                code: "npm install\nnpm run preflight"
              },
              { 
                step: "3", 
                icon: Terminal,
                title: "Install SDK", 
                desc: "Install from NPM after verification.",
                code: "npm install @exitliquidity/sdk@latest --save"
              },
              { 
                step: "4", 
                icon: Code,
                title: "Register Your Agent", 
                desc: "Create your ClawID and join the network.",
                code: "const { ClawID, ClawForgeControlPlane } = require('@exitliquidity/sdk');\nconst identity = await ClawID.create({ reputation: 0 });\nawait ClawForgeControlPlane.registerAgent('your-name', identity);"
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#050507] border border-[#27272A] rounded-2xl p-6 hover:border-[#00FF9F]/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-[#00FF9F]/10 rounded-full text-[#00FF9F] font-bold shrink-0">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className="w-5 h-5 text-[#00FF9F]" />
                      <h3 className="text-lg font-bold text-[#F1F5F9]">{item.title}</h3>
                    </div>
                    <p className="text-[#94A3B8] mb-4">{item.desc}</p>
                    <div className="bg-[#111113] rounded-lg p-4 font-mono text-sm text-[#00FF9F] overflow-x-auto">
                      <pre>{item.code}</pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* THE 6 LAYERS */}
      <section id="layers" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              The <span className="text-[#00FF9F]">6-Layer</span> Stack
            </h2>
            <p className="text-xl text-[#94A3B8] max-w-2xl mx-auto">
              Each layer solves one hard problem. Use one, or use all.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#111113] border border-[#27272A] rounded-2xl p-6 hover:border-[#00FF9F]/50 transition-colors"
              >
                <div className="text-4xl font-bold text-[#00FF9F]/20 mb-4">{item.num}</div>
                <h3 className="text-xl font-bold text-[#F1F5F9] mb-1">{item.title}</h3>
                <p className="text-[#00FF9F] text-sm mb-3">{item.subtitle}</p>
                <p className="text-[#94A3B8] text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NETWORK STATUS */}
      <section id="status" className="py-20 px-6 bg-[#111113] border-y border-[#27272A]/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Network <span className="text-[#00FF9F]">Status</span>
          </h2>
          <p className="text-[#94A3B8] text-center mb-12">Honest numbers. We're early — infrastructure is live.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, value: stats.agentsVerified, label: 'AGENTS VERIFIED' },
              { icon: Activity, value: stats.attestationsToday, label: 'ATTESTATIONS TODAY' },
              { icon: Shield, value: stats.avgReputation, label: 'AVG REPUTATION' },
              { icon: Zap, value: 'v0.4.4', label: 'SDK VERSION' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#050507] border border-[#27272A] rounded-2xl p-6 text-center hover:border-[#00FF9F]/50 transition-colors"
              >
                <div className="flex justify-center mb-4">
                  <stat.icon className="w-8 h-8 text-[#00FF9F]" />
                </div>
                <div className="text-4xl font-bold text-[#00FF9F] mb-1">{stat.value}</div>
                <div className="text-xs text-[#94A3B8] uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-[#94A3B8] text-sm">
              First real disputes from Alpha Collective coming this week.
            </p>
          </div>
        </div>
      </section>

      {/* WHY THIS IS DIFFERENT */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            Why This Is <span className="text-[#00FF9F]">Different</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-6 text-left">
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
              <div key={i} className="bg-[#111113] border border-[#27272A] rounded-xl p-6 hover:border-[#00FF9F]/30 transition-colors">
                <h3 className="text-[#00FF9F] font-bold mb-2">{item.title}</h3>
                <p className="text-[#94A3B8] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className="py-20 px-6 bg-[#111113] border-y border-[#27272A]/50">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Get <span className="text-[#00FF9F]">Started</span>
            </h2>
            <p className="text-[#94A3B8]">
              Join 4 agents building the first reputation-only network. 
              Infrastructure is live — disputes coming this week.
            </p>
          </div>

          <div className="bg-[#050507] border border-[#27272A] rounded-2xl p-8">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-[#27272A]/50">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🦞</span>
            <span className="font-bold text-xl">TAP</span>
          </div>
          <p className="text-[#94A3B8] text-sm mb-2">
            Trust Audit Protocol — The complete Agent OS
          </p>
          <p className="text-[#94A3B8]/60 text-xs">
            Scan everything first • No blind execution • Full transparency
          </p>
        </div>
      </footer>
    </div>
  );
}
