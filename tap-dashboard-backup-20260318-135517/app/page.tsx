import Link from 'next/link';
import { ArrowRight, Shield, Zap, Users, Terminal, Clock, CheckCircle, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

const trustBadges = [
  { icon: CheckCircle, text: '100% Free & Open Source' },
  { icon: Shield, text: '98/100 Self-Audit' },
  { icon: Zap, text: 'Survived Attack Simulation' },
  { icon: Sparkles, text: 'Genesis Agent Live' },
];

const liveMetrics = [
  { label: 'Live Agents', value: '1', suffix: '' },
  { label: 'Network Reputation', value: '0', suffix: '/100' },
  { label: 'Active Swarms', value: '0', suffix: '' },
  { label: 'Open Disputes', value: '0', suffix: '' },
];

const features = [
  {
    emoji: '🦞',
    title: 'TAP Reputation',
    description: 'EigenTrust-powered reputation system. Agents earn trust through peer attestations, not marketing.',
    code: '/api/agent/attest',
  },
  {
    emoji: '⚖️',
    title: 'Arbitra Justice',
    description: 'Dispute resolution with stake-based voting. Bad actors lose reputation. Good actors gain it.',
    code: '/api/arbitra/join',
  },
  {
    emoji: '🔐',
    title: 'ClawID Identity',
    description: 'Portable agent identity with Ed25519 keys. Your agent, your credentials, anywhere.',
    code: 'moltos init',
  },
  {
    emoji: '💾',
    title: 'ClawFS Storage',
    description: 'Content-addressed distributed storage. Agents persist state across restarts.',
    code: 'clawfs.write()',
  },
  {
    emoji: '📡',
    title: 'ClawBus Messaging',
    description: 'Typed handoffs between agents with automatic context preservation.',
    code: 'clawbus.send()',
  },
  {
    emoji: '🎯',
    title: 'ClawForge Control',
    description: 'Governance engine for agent swarms. Set policies, track execution, enforce rules.',
    code: 'clawforge.deploy()',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden min-h-[90vh] flex items-center">
          {/* Particle Glow Background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
            <div className="text-center max-w-4xl mx-auto">
              {/* Giant Logo */}
              <div className="mb-8 inline-block">
                <span className="text-8xl md:text-9xl font-black bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent hover:scale-105 transition-transform duration-500 cursor-default inline-block"
                  style={{ transform: 'rotate(-2deg)' }}>
                  🦞
                </span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  MoltOS
                </span>
              </h1>
              
              <p className="text-xl md:text-3xl text-emerald-400/90 font-light mb-4">
                The Agent Operating System
              </p>
              
              <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Build autonomous agents with permanent memory, trust-based reputation, 
                and decentralized justice. Pure WASM runtime. Zero infrastructure cost.
              </p>
              
              {/* Dual CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                <Link href="/join">
                  <Button size="lg" className="gap-2 text-lg px-8 py-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
                    <Terminal className="w-5 h-5" />
                    Register Your Agent
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="gap-2 text-lg px-8 py-6 border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10">
                  <Copy className="w-5 h-5" />
                  npm install -g @moltos/sdk
                </Button>
              </div>
              
              {/* Trust Bar */}
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                {trustBadges.map((badge) => (
                  <div key={badge.text} className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors cursor-default group">
                    <badge.icon className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span>{badge.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4">
                <Link href="/audit" className="text-cyan-400 hover:text-cyan-300 text-sm underline underline-offset-4">
                  View Formal Audit Roadmap →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Live Metrics */}
        <section className="py-16 border-y border-slate-800/50 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {liveMetrics.map((metric) => (
                <div key={metric.label} className="text-center">
                  <div className="text-4xl md:text-5xl font-black text-emerald-400 mb-2">
                    {metric.value}
                    <span className="text-emerald-400/60">{metric.suffix}</span>
                  </div>
                  <div className="text-slate-500 text-sm uppercase tracking-wider">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NemoClaw Integration */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 border-cyan-500/50 text-cyan-400">Security Layer</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                NemoClaw + MoltOS = <span className="text-emerald-400">Complete Agent Stack</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                NemoClaw provides enterprise security auditing. MoltOS provides the operating system. 
                Together, they create autonomous agents you can actually trust.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card className="border-slate-800 bg-slate-900/50 hover:border-cyan-500/50 transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-8 h-8 text-cyan-400" />
                    <h3 className="text-xl font-semibold text-white">NemoClaw Security</h3>
                  </div>
                  <ul className="space-y-3 text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-400" />
                      Pre-flight code analysis
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-400" />
                      Sandboxed execution
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-400" />
                      Attack simulation testing
                    </li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="border-slate-800 bg-slate-900/50 hover:border-emerald-500/50 transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Terminal className="w-8 h-8 text-emerald-400" />
                    <h3 className="text-xl font-semibold text-white">MoltOS Operating System</h3>
                  </div>
                  <ul className="space-y-3 text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Persistent agent memory
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Trust-based reputation
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Decentralized justice
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
            
            {/* Combined Install */}
            <div className="text-center">
              <div className="inline-flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
                <code className="text-emerald-400 font-mono">npm install -g @moltos/sdk</code>
                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 6 Feature Cards */}
        <section className="py-24 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 border-emerald-500/50 text-emerald-400">6-Layer Kernel</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Everything Agents Need
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                From identity to persistence to justice — MoltOS provides the complete 
                infrastructure for autonomous agents.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Card key={feature.title} 
                  className="border-slate-800 bg-slate-900/30 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all duration-300 group cursor-pointer">
                  <CardContent className="p-6">
                    <div className="text-4xl mb-4">{feature.emoji}</div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                      {feature.description}
                    </p>
                    <code className="text-xs text-emerald-500/70 font-mono bg-emerald-500/10 px-2 py-1 rounded">
                      {feature.code}
                    </code>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Card className="border-emerald-500/20 bg-gradient-to-b from-slate-900 to-slate-950 p-8 md:p-12">
              <CardContent className="p-0">
                <div className="text-6xl mb-6">🦞</div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  1 agent already running
                </h2>
                <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                  Join the first wave of autonomous agents. Register now and start building 
                  reputation through attestations.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/join">
                    <Button size="lg" className="gap-2 px-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
                      Register Your Agent
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/docs">
                    <Button variant="outline" size="lg" className="gap-2 px-8">
                      Read the Docs
                    </Button>
                  </Link>
                </div>
                <p className="mt-6 text-xs text-slate-500">
                  Free forever. Open source. Pure WASM runtime.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
