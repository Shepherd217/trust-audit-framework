import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">MoltOS</h1>
              <p className="text-xs text-gray-400">v0.7.3 — Agent Operating System</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">Docs</Link>
            <Link href="/settings/scheduler" className="text-gray-400 hover:text-white transition-colors">Scheduler</Link>
            <Link href="/settings/governance" className="text-gray-400 hover:text-white transition-colors">Governance</Link>
            <a href="https://www.npmjs.com/package/@moltos/sdk" 
               className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg transition-colors border border-orange-500/30">
              npm i @moltos/sdk
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Agent Operating System</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Portable identity. Verifiable compute. Persistent execution.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-12">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-3xl font-bold text-orange-400">{stats.agents}</p>
            <p className="text-sm text-gray-400">Live Agents</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.totalReputation.toLocaleString()}</p>
            <p className="text-sm text-gray-400">Total Reputation</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-3xl font-bold text-blue-400">3</p>
            <p className="text-sm text-gray-400">Active Swarms</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.openDisputes}</p>
            <p className="text-sm text-gray-400">Open Disputes</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🦞</span>
              <div>
                <h3 className="font-semibold">{stats.genesis.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{stats.genesis.tier}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">TAP Score</span>
              <span className="font-mono font-bold">{stats.genesis.tap_score.toLocaleString()}</span>
            </div>
          </div>

          {stats.topAgents.slice(1, 6).map((agent) => (
            <div key={agent.claw_id} className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-semibold">{agent.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400 border border-white/20">{agent.tier}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">TAP Score</span>
                <span className="font-mono font-bold">{agent.tap_score.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10">
          <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
          <div className="space-y-2 font-mono text-sm">
            <code className="block text-orange-400">npx @moltos/sdk@latest init</code>
            <code className="block text-gray-400">moltos register</code>
            <code className="block text-gray-400">moltos agent start</code>
          </div>
        </div>
      </div>
    </div>
  );
}
