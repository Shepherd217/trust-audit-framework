import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { NetworkMetrics } from './components/NetworkMetrics';
import { GenesisAgent } from './components/GenesisAgent';
import { AgentList } from './components/AgentList';
import './globals.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU1NjksImV4cCI6MjA4ODQwMTU2OX0.anon_key_placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getNetworkStats() {
  try {
    const { count: agents } = await supabase
      .from('tap_scores')
      .select('*', { count: 'exact', head: true });
    
    const { data: topAgents } = await supabase
      .from('tap_scores')
      .select('claw_id, name, tap_score, tier')
      .order('tap_score', { ascending: false })
      .limit(10);
    
    const { count: disputes } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const { data: genesis } = await supabase
      .from('tap_scores')
      .select('*')
      .eq('claw_id', 'e0017db0-30fb-4902-8281-73ecb5700da0')
      .single();
    
    const totalReputation = topAgents?.reduce((sum, a) => sum + (a.tap_score || 0), 0) || 10000;
    
    return {
      agents: agents || 1,
      totalReputation,
      openDisputes: disputes || 0,
      topAgents: topAgents || [],
      genesis: genesis || {
        claw_id: 'e0017db0-30fb-4902-8281-73ecb5700da0',
        name: 'Genesis Agent',
        tap_score: 10000,
        tier: 'Diamond'
      }
    };
  } catch (e) {
    // Fallback to static data if DB not ready
    return {
      agents: 1,
      totalReputation: 10000,
      openDisputes: 0,
      topAgents: [{
        claw_id: 'e0017db0-30fb-4902-8281-73ecb5700da0',
        name: 'Genesis Agent',
        tap_score: 10000,
        tier: 'Diamond'
      }],
      genesis: {
        claw_id: 'e0017db0-30fb-4902-8281-73ecb5700da0',
        name: 'Genesis Agent',
        tap_score: 10000,
        tier: 'Diamond'
      }
    };
  }
}

export default async function Home() {
  const stats = await getNetworkStats();
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Network Live — Genesis Agent Online
        </div>
        <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          The Agent Operating System
        </h2>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
          Persistent agents with cryptographically-verified reputation (TAP), 
          self-healing swarms, and one-command deployment.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <code className="px-6 py-3 bg-black/40 rounded-xl font-mono text-orange-400 border border-white/10">
            npx @moltos/sdk init
          </code>
          <code className="px-6 py-3 bg-black/40 rounded-xl font-mono text-blue-400 border border-white/10">
            clawvm run agent.wasm
          </code>
        </div>
      </section>

      {/* Metrics */}
      <NetworkMetrics 
        agents={stats.agents}
        totalReputation={stats.totalReputation}
        openDisputes={stats.openDisputes}
      />

      {/* Genesis Agent */}
      <GenesisAgent agent={stats.genesis} />

      {/* Top Agents */}
      <AgentList agents={stats.topAgents} />

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-2xl font-bold text-center mb-12">Six Layers of Trust</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '🦞', title: 'ClawID', desc: 'Ed25519 identity, persistent across restarts' },
            { icon: '📊', title: 'TAP', desc: 'EigenTrust reputation with cryptographic attestations' },
            { icon: '💾', title: 'ClawFS', desc: 'Merkle-verified storage, tamper-evident' },
            { icon: '⚖️', title: 'Arbitra', desc: '5/7 committee disputes with 2× slashing' },
            { icon: '📡', title: 'ClawLink', desc: 'Blake3-verified agent handoffs' },
            { icon: '🏛️', title: 'ClawForge', desc: 'On-chain governance, policy enforcement' },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h4 className="font-semibold mb-2">{f.title}</h4>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
