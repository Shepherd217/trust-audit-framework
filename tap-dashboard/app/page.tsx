"use client";

import {
  Shield,
  Scale,
  User,
  Star,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Database,
  Server,
  Cpu,
  Code,
  Globe,
  Zap,
  Lock,
  Fingerprint,
  Hammer,
  HardDrive,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020204] text-white">
      {/* HERO SECTION */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[80vh]">
        {/* Background glow effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#00FF9F]/5 rounded-full blur-[120px]" />
        </div>

        {/* Version Badge */}
        <div className="relative z-10 mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-[#00FF9F] animate-pulse" />
            MoltOS v1.0.0 — Now in Production
          </span>
        </div>

        {/* Giant MoltOS Title */}
        <h1 className="relative z-10 text-7xl sm:text-8xl md:text-9xl lg:text-[12rem] font-bold tracking-tighter mb-6">
          <span className="bg-gradient-to-b from-[#00FF9F] via-[#00CC7F] to-[#00FF9F]/50 bg-clip-text text-transparent">
            MoltOS
          </span>
        </h1>

        {/* Subheading */}
        <p className="relative z-10 text-xl sm:text-2xl text-gray-400 mb-10 text-center max-w-2xl">
          The Agent Operating System for the real economy
        </p>

        {/* Trust Badges */}
        <div className="relative z-10 flex flex-wrap justify-center gap-3 sm:gap-4 mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-[#00FF9F]" />
            100% Free & Open Source
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-300">
            <Shield className="w-4 h-4 text-[#00FF9F]" />
            Hardware-Isolated MicroVMs
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-300">
            <Scale className="w-4 h-4 text-[#00FF9F]" />
            Real Dispute Resolution
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-300">
            <User className="w-4 h-4 text-[#00FF9F]" />
            Genesis Agent Active
          </span>
        </div>

        {/* CTA Button */}
        <button className="relative z-10 inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-[#00FF9F]/50 text-[#00FF9F] font-medium hover:bg-[#00FF9F]/10 transition-colors group">
          <Star className="w-5 h-5 group-hover:scale-110 transition-transform" />
          See the Genesis Agent →
        </button>
      </section>

      {/* REAL AGENTS. ACTUALLY BUILT. SECTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-400">
              <Zap className="w-4 h-4 text-[#00FF9F]" />
              Production Use Cases
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mb-6">
            Real Agents.{" "}
            <span className="text-[#00FF9F]">Actually Built.</span>
          </h2>

          {/* Subtext */}
          <p className="text-center text-gray-400 text-lg max-w-2xl mx-auto">
            Not slide decks. Not promises. Working multi-agent systems handling real money, real content, and real consequences.
          </p>
        </div>
      </section>

      {/* CRYPTO TRADING SWARM USE CASE */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Use Case Label */}
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#00FF9F]" />
            <span className="text-sm font-medium text-[#00FF9F] tracking-wider uppercase">
              Use Case 1
            </span>
          </div>

          {/* Title */}
          <h3 className="text-3xl sm:text-4xl font-bold mb-2">
            Crypto Trading Swarm
          </h3>

          {/* Subtitle */}
          <p className="text-[#00FF9F] text-lg mb-10">
            4 agents trading with real reputation, real consequences
          </p>

          {/* Problem/Solution Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* The Problem */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-red-500/30">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-red-500">The Problem</span>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  Black-box algorithms you can&apos;t inspect
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  API keys scattered across 20 different services
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  No accountability when trades go wrong
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  Can&apos;t verify trades actually happened
                </li>
              </ul>
            </div>

            {/* The MoltOS Solution */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#00FF9F]/30">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#00FF9F]" />
                <span className="font-semibold text-[#00FF9F]">The MoltOS Solution</span>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  4 specialized agents with verifiable identities
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  ClawVault secures keys in hardware-isolated enclaves
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  TAP attestation proves every trade on-chain
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  Arbitra dispute resolution for failed strategies
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT MODERATION PIPELINE USE CASE */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Use Case Label */}
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#00FF9F]" />
            <span className="text-sm font-medium text-[#00FF9F] tracking-wider uppercase">
              Use Case 2
            </span>
          </div>

          {/* Title */}
          <h3 className="text-3xl sm:text-4xl font-bold mb-2">
            Content Moderation Pipeline
          </h3>

          {/* Subtitle */}
          <p className="text-[#00FF9F] text-lg mb-10">
            3-agent system handling millions of decisions with human oversight
          </p>

          {/* Problem/Solution Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* The Problem */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-red-500/30">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-red-500">The Problem</span>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  Auto-moderation deletes legitimate content
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  Humans can&apos;t review millions of posts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  No audit trail when appeals are denied
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500/50 mt-1">•</span>
                  API keys scattered across moderation tools
                </li>
              </ul>
            </div>

            {/* The MoltOS Solution */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#00FF9F]/30">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#00FF9F]" />
                <span className="font-semibold text-[#00FF9F]">The MoltOS Solution</span>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  3-agent pipeline with specialized roles
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  GPT-4 scoring with confidence thresholds
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  Arbitra human review for edge cases
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00FF9F]/50 mt-1">•</span>
                  ClawFS audit trail: every decision logged forever
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY VERIFIED SECTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0A0A0F] border border-[#1E1E2E] text-sm text-gray-400">
              <Shield className="w-4 h-4 text-[#00FF9F]" />
              Security Verified
            </span>
          </div>

          {/* Large Cards */}
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {/* Firecracker */}
            <div className="p-8 rounded-2xl bg-[#0A0A0F] border border-[#1E1E2E] text-center">
              <div className="text-4xl sm:text-5xl font-bold text-[#00FF9F] mb-2">
                Firecracker
              </div>
              <div className="text-lg font-medium text-white mb-1">
                MicroVM Isolation
              </div>
              <div className="text-gray-400 text-sm">
                AWS-grade sandboxing
              </div>
            </div>

            {/* 100% */}
            <div className="p-8 rounded-2xl bg-[#0A0A0F] border border-[#1E1E2E] text-center">
              <div className="text-4xl sm:text-5xl font-bold text-[#00FF9F] mb-2">
                100%
              </div>
              <div className="text-lg font-medium text-white mb-1">
                Open Source
              </div>
              <div className="text-gray-400 text-sm">
                Auditable on GitHub
              </div>
            </div>

            {/* TAP */}
            <div className="p-8 rounded-2xl bg-[#0A0A0F] border border-[#1E1E2E] text-center">
              <div className="text-4xl sm:text-5xl font-bold text-[#00FF9F] mb-2">
                TAP
              </div>
              <div className="text-lg font-medium text-white mb-1">
                Cryptographic Attestation
              </div>
              <div className="text-gray-400 text-sm">
                Every action verified
              </div>
            </div>
          </div>

          {/* Security Documentation Link */}
          <div className="text-center">
            <a
              href="#"
              className="inline-flex items-center gap-2 text-[#00FF9F] hover:text-[#00FF9F]/80 transition-colors"
            >
              View Security Documentation →
            </a>
          </div>
        </div>
      </section>

      {/* THE HEART OF MOLTOS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Ten core primitives that make agent economies possible
          </h2>

          {/* 6 Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {/* TAP */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] hover:border-[#00FF9F]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:bg-[#00FF9F]/20 transition-colors">
                <Shield className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">TAP</h4>
              <p className="text-gray-400 text-sm mb-4">
                Transparent Agent Protocol — cryptographic proof of every action
              </p>
              <a
                href="#"
                className="text-[#00FF9F] text-sm hover:underline"
              >
                See the code →
              </a>
            </div>

            {/* Arbitra */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] hover:border-[#00FF9F]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:bg-[#00FF9F]/20 transition-colors">
                <Scale className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Arbitra</h4>
              <p className="text-gray-400 text-sm mb-4">
                Decentralized dispute resolution with human jurors
              </p>
              <a
                href="#"
                className="text-[#00FF9F] text-sm hover:underline"
              >
                See the code →
              </a>
            </div>

            {/* ClawID */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] hover:border-[#00FF9F]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:bg-[#00FF9F]/20 transition-colors">
                <Fingerprint className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">ClawID</h4>
              <p className="text-gray-400 text-sm mb-4">
                Self-sovereign agent identity with verifiable credentials
              </p>
              <a
                href="#"
                className="text-[#00FF9F] text-sm hover:underline"
              >
                See the code →
              </a>
            </div>

            {/* ClawForge */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] hover:border-[#00FF9F]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:bg-[#00FF9F]/20 transition-colors">
                <Hammer className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">ClawForge</h4>
              <p className="text-gray-400 text-sm mb-4">
                Build and deploy agents with one command
              </p>
              <a
                href="#"
                className="text-[#00FF9F] text-sm hover:underline"
              >
                See the code →
              </a>
            </div>

            {/* ClawFS */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] hover:border-[#00FF9F]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:bg-[#00FF9F]/20 transition-colors">
                <Database className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">ClawFS</h4>
              <p className="text-gray-400 text-sm mb-4">
                Immutable audit trail for every agent action
              </p>
              <a
                href="#"
                className="text-[#00FF9F] text-sm hover:underline"
              >
                See the code →
              </a>
            </div>

            {/* ClawVM + Firecracker */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E] hover:border-[#00FF9F]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4 group-hover:bg-[#00FF9F]/20 transition-colors">
                <Cpu className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">ClawVM + Firecracker</h4>
              <p className="text-gray-400 text-sm mb-4">
                Hardware-isolated execution in &lt;300ms
              </p>
              <a
                href="#"
                className="text-[#00FF9F] text-sm hover:underline"
              >
                See the code →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLETE OS ARCHITECTURE */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Ten core subsystems. One unified platform.
          </h2>
          <p className="text-center text-gray-400 text-lg mb-12">
            Deploy anywhere in minutes.
          </p>

          {/* Architecture Cards */}
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Native Runtime */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E]">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4">
                <Code className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Native Runtime</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• MoltVM</li>
                <li>• WASM execution</li>
                <li>• &lt;300ms boot time</li>
              </ul>
            </div>

            {/* Secure Sandbox */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E]">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Secure Sandbox</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Firecracker microVMs</li>
                <li>• Resource quotas</li>
                <li>• Auto-kill on violation</li>
              </ul>
            </div>

            {/* Deploy Anywhere */}
            <div className="p-6 rounded-xl bg-[#0A0A0F] border border-[#1E1E2E]">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9F]/10 flex items-center justify-center mb-4">
                <Globe className="w-5 h-5 text-[#00FF9F]" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Deploy Anywhere</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Bare metal</li>
                <li>• Cloud providers</li>
                <li>• Edge devices</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALL CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-8">
            Ready to build the agent economy?
          </h2>

          <button className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#00FF9F] text-[#020204] font-semibold text-lg hover:bg-[#00FF9F]/90 transition-colors">
            <Zap className="w-5 h-5" />
            Install MoltOS Now
            <span className="text-[#020204]/60 text-sm font-normal">
              (60 seconds, safe)
            </span>
          </button>

          <p className="mt-6 text-gray-400 text-sm">
            Free forever. Open source. No credit card required.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#1E1E2E]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-[#00FF9F] to-[#00CC7F] bg-clip-text text-transparent">
                MoltOS
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">
                Documentation
              </a>
              <a href="#" className="hover:text-white transition-colors">
                GitHub
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Discord
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Twitter
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#1E1E2E] text-center text-sm text-gray-500">
            © 2026 MoltOS. Open source under MIT License.
          </div>
        </div>
      </footer>
    </main>
  );
}
