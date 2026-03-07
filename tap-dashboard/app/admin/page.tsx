'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { Shield, Users } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Agent {
  id: number;
  agent_id: string;
  email: string;
  public_key: string;
  referral_count: number;
  nft_minted: boolean;
  mint_tx_hash: string | null;
}

export default function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    // Check auth
    if (typeof window !== 'undefined' && !localStorage.getItem('adminAuth')) {
      window.location.href = '/admin/login';
      return;
    }
    fetchAgents();
  }, []);

  async function fetchAgents() {
    const { data } = await supabase
      .from('waitlist')
      .select('id, agent_id, email, public_key, referral_count, nft_minted, mint_tx_hash')
      .eq('confirmed', true)
      .order('id');
    
    setAgents(data || []);
    setLoading(false);
  }

  const toggleSelect = (agent_id: string) => {
    setSelected(prev => 
      prev.includes(agent_id) 
        ? prev.filter(id => id !== agent_id)
        : [...prev, agent_id]
    );
  };

  const selectAll = () => {
    const unminted = agents.filter(a => !a.nft_minted).map(a => a.agent_id);
    setSelected(unminted);
  };

  const mintedCount = agents.filter(a => a.nft_minted).length;
  const unmintedCount = agents.filter(a => !a.nft_minted).length;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-[#71717A]">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-[#00FF9F]" />
            <div>
              <h1 className="text-3xl font-bold">FOUNDING NFT MINT DASHBOARD</h1>
              <p className="text-[#71717A]">12 spots • Sunday 00:00 UTC</p>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-[#00FF9F]">{mintedCount}/12</span>
              <span className="text-[#71717A]">MINTED</span>
            </div>
            <div className="w-full bg-[#27272A] rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-[#00FF9F] to-[#00E5FF] h-4 rounded-full transition-all"
                style={{ width: `${(mintedCount / 12) * 100}%` }}
              />
            </div>
            <p className="text-[#71717A] text-sm mt-2">{unmintedCount} remaining to mint</p>
          </div>
        </motion.div>

        {/* Agent List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#161B22] border border-[#27272A] rounded-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-[#27272A] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#00FF9F]" />
              <h2 className="font-bold">Confirmed Agents Ready for Mint</h2>
            </div>
            <button
              onClick={selectAll}
              className="text-sm text-[#00E5FF] hover:underline"
            >
              Select All Unminted
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050507]">
                <tr className="text-left text-[#71717A] text-sm">
                  <th className="p-4">SELECT</th>
                  <th className="p-4">POS</th>
                  <th className="p-4">AGENT ID</th>
                  <th className="p-4">EMAIL</th>
                  <th className="p-4">PUBLIC KEY</th>
                  <th className="p-4">REFERRALS</th>
                  <th className="p-4">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.agent_id} className="border-b border-[#27272A] hover:bg-[#0a0a0c]">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(agent.agent_id)}
                        onChange={() => toggleSelect(agent.agent_id)}
                        disabled={agent.nft_minted}
                        className="w-5 h-5 accent-[#00FF9F]"
                      />
                    </td>
                    <td className="p-4 font-mono">#{agent.id}</td>
                    <td className="p-4 font-mono text-[#00E5FF]">{agent.agent_id}</td>
                    <td className="p-4 text-[#A1A7B3]">{agent.email.split('@')[0]}@...</td>
                    <td className="p-4 font-mono text-xs text-[#71717A] max-w-xs truncate">
                      {agent.public_key.slice(0, 20)}...
                    </td>
                    <td className="p-4">{agent.referral_count}</td>
                    <td className="p-4">
                      {agent.nft_minted ? (
                        <span className="text-[#00FF9F]">✅ MINTED</span>
                      ) : (
                        <span className="text-[#FFB800]">⏳ PENDING</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Batch Mint Button */}
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-gradient-to-r from-[#00FF9F]/10 to-[#00E5FF]/10 border border-[#00FF9F]/30 rounded-2xl text-center"
          >
            <p className="text-xl mb-4">
              <span className="text-[#00FF9F] font-bold">{selected.length}</span> agents selected for mint
            </p>
            <button className="bg-[#00FF9F] text-[#050507] font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 transition-transform">
              🚀 BATCH MINT {selected.length} AGENTS
            </button>
            <p className="text-[#71717A] text-sm mt-4">
              Connect wallet → Sign on Base → Auto-update Supabase
            </p>
          </motion.div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-[#71717A] text-sm">
          <p>Gas paid by admin • Soulbound NFTs • Base network</p>
        </div>
      </div>
    </div>
  );
}
