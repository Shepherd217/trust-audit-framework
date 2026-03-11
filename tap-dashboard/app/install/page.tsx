'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Shield, Eye, Copy, Check, ExternalLink, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function InstallPage() {
  const [copied, setCopied] = useState(false);

  const installCommand = 'npx @moltos/sdk@latest init';

  const copyCommand = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      title: 'Preflight Scan',
      description: 'Safety check runs first — see every file, permission, and dependency before install.',
      icon: Shield,
    },
    {
      title: 'Transparent Install',
      description: 'Every line of code is auditable on GitHub. No hidden scripts. No surprises.',
      icon: Eye,
    },
    {
      title: 'Production Ready',
      description: '60 seconds to a fully configured agent runtime with sandbox, storage, and observability.',
      icon: Terminal,
    },
  ];

  return (
    <div className="min-h-screen bg-[#020204] text-[#F8FAFC] selection:bg-[#00FF9F]/30">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#00FF9F]/5 via-transparent to-[#22C55E]/5 pointer-events-none" />

      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020204]/70 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span className="font-bold text-xl">MoltOS</span>
            </Link>
            <Link href="/" className="text-[#94A3B8] hover:text-[#00FF9F] transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/20 mb-8">
              <Shield className="w-4 h-4 text-[#00FF9F]" />
              <span className="text-sm text-[#00FF9F] font-medium">Safe & Transparent Install</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Install MoltOS in{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF9F] to-[#22C55E]">
                60 Seconds
              </span>
            </h1>

            <p className="text-xl text-[#94A3B8] mb-10 max-w-2xl mx-auto">
              No curl. No hidden scripts. Full transparency with mandatory preflight checks.
            </p>

            {/* Install Command */}
            <div className="bg-[#0A0A0F] border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                  <Terminal className="w-4 h-4" />
                  <span>Run in your terminal</span>
                </div>
                <button
                  onClick={copyCommand}
                  className="flex items-center gap-1 text-sm text-[#00FF9F] hover:text-[#00FF9F]/80 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="bg-black/50 rounded-xl p-4 font-mono text-lg text-left overflow-x-auto">
                <span className="text-[#00FF9F]">$</span> {installCommand}
              </div>

              <p className="text-sm text-[#64748B] mt-4">
                Or tell your agent:{' '}
                <Link href="/skill.md" className="text-[#00FF9F] hover:underline">
                  "Install from skill.md"
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-12 text-center">How Safe Install Works</h2>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-6"
              >
                <div className="w-12 h-12 rounded-xl bg-[#00FF9F]/10 flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-6 h-6 text-[#00FF9F]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-[#94A3B8]">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency Links */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-gradient-to-b from-transparent to-[#00FF9F]/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Full Transparency</h2>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'View Source', href: 'https://github.com/Shepherd217/clawos', icon: ExternalLink },
              { label: 'Audit Checklist', href: '#', icon: Shield },
              { label: 'Skill Definition', href: '/skill.md', icon: ChevronRight },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#00FF9F]/30 hover:bg-white/[0.07] transition-all"
              >
                <span>{link.label}</span>
                <link.icon className="w-4 h-4 text-[#00FF9F]" />
              </Link>
            ))}
          </div>

          <div className="mt-12 p-6 bg-[#0A0A0F] border border-white/10 rounded-xl text-left">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#00FF9F]" />
              What This Command Does
            </h3>
            <ul className="space-y-2 text-[#94A3B8] text-sm">
              <li>1. Downloads @moltos/sdk from npm (verified package)</li>
              <li>2. Runs preflight safety scan (files, permissions, network)</li>
              <li>3. Shows you exactly what will be installed</li>
              <li>4. Sets up MoltOS runtime with ClawVM + Firecracker</li>
              <li>5. Configures ClawFS for state persistence</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-[#94A3B8]">
            © 2025 MoltOS. No curl • Full transparency • Open source
          </p>
        </div>
      </footer>
    </div>
  );
}
