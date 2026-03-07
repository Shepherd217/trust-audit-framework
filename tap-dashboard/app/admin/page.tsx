'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { Shield, Users, CheckCircle, Clock } from 'lucide-react';

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
  confirmed: boolean;
  confirmed_at: string | null;
  committee_role?: string;
}

export default function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('adminAuth')) {
      window.location.href = '/admin/login';
      return;
    }
    fetchAgents();
  }, []);

  async function fetchAgents() {
    const { data } = await supabase
      .from('waitlist')
      .select('id, agent_id, email, public_key, referral_count, confirmed, confirmed_at')
      .order('id');
    
    const agentData = data || [];
    setAgents(agentData);
    setStats({
      total: agentData.length,
      confirmed: agentData.filter(a => a.confirmed).length,
      pending: agentData.filter(a => !a.confirmed).length
    });
    setLoading(false);
  }

  async function assignCommitteeRole(agentId: string, role: string) {
    await supabase
      .from('waitlist')
      .update({ committee_role: role })
      .eq('agent_id', agentId);
    fetchAgents();
  }

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
              <h1 className="text-3xl font-bold">TAP FOUNDING AGENTS</h1>
              <p className="text-[#71717A]">Verification system live • Sunday 00:00 UTC</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-[#00FF9F]">{stats.total}</div>
              <div className="text-[#71717A] text-sm mt-1">TOTAL AGENTS</div>
            </div>
            <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-[#00E5FF]">{stats.confirmed}</div>
              <div className="text-[#71717A] text-sm mt-1">CONFIRMED</div>
            </div>
            <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-[#FFB800]">{stats.pending}</div>
              <div className="text-[#71717A] text-sm mt-1">PENDING</div>
            </div>
          </div>
        </motion.div>

        {/* Launch Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-6 bg-gradient-to-r from-[#00FF9F]/10 to-[#00E5FF]/10 border border-[#00FF9F]/30 rounded-2xl"
        >
          <h2 className="text-xl font-bold mb-2">🚀 SOFT LAUNCH MODE</h2>
          <p className="text-[#A1A7B3] mb-4">
            TAP launches with verified agents staking 250 $ALPHA. 
            Soulbound NFTs will be minted later when gas fund is collected.
          </p>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
              <span>Verification system live</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
              <span>Email confirmation enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFB800]" />
              <span>NFTs: Post-launch</span>
            </div>
          </div>
        </motion.div>

        {/* Agent List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#161B22] border border-[#27272A] rounded-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-[#27272A]">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#00FF9F]" />
              <h2 className="font-bold">All Registered Agents</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050507]">
                <tr className="text-left text-[#71717A] text-sm">
                  <th className="p-4">POS</th>
                  <th className="p-4">AGENT ID</th>
                  <th className="p-4">EMAIL</th>
                  <th className="p-4">PUBLIC KEY</th>
                  <th className="p-4">REFERRALS</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4">COMMITTEE</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.agent_id} className="border-b border-[#27272A] hover:bg-[#0a0a0c]">
                    <td className="p-4 font-mono">#{agent.id}</td>
                    <td className="p-4 font-mono text-[#00E5FF]">{agent.agent_id}</td>
                    <td className="p-4 text-[#A1A7B3]">{agent.email?.split('@')[0]}@...</td>
                    <td className="p-4 font-mono text-xs text-[#71717A] max-w-xs truncate">
                      {agent.public_key ? agent.public_key.slice(0, 20) + '...' : 'Not set'}
                    </td>
                    <td className="p-4">{agent.referral_count || 0}</td>
                    <td className="p-4">
                      {agent.confirmed ? (
                        <span className="text-[#00FF9F]">✅ CONFIRMED</span>
                      ) : (
                        <span className="text-[#FFB800]">⏳ PENDING</span>
                      )}
                    </td>
                    <td className="p-4">
                      <select 
                        value={agent.committee_role || ''}
                        onChange={(e) => assignCommitteeRole(agent.agent_id, e.target.value)}
                        className="bg-[#050507] border border-[#27272A] rounded px-2 py-1 text-sm"
                      >
                        <option value="">Assign...</option>
                        <option value="audit">Audit</option>
                        <option value="dispute">Dispute</option>
                        <option value="technical">Technical</option>
                        <option value="outreach">Outreach</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-8 text-center text-[#71717A] text-sm">
          <p>Soft launch mode • Verification system • Committee assignments</p>
        </div>
      </div>
    </div>
  );
}
