'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { Shield, Users, CheckCircle, Clock } from 'lucide-react';

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

// Lazy create Supabase client (only on client)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON;
  
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  
  return createClient(url, key);
}

export default function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('adminAuth')) {
      window.location.href = '/login';
      return;
    }
    
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('waitlist')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        setAgents(data as Agent[]);
        setStats({
          total: data.length,
          confirmed: data.filter((a: any) => a.confirmed).length,
          pending: data.filter((a: any) => !a.confirmed).length,
        });
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-[#00FF9F] mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage Genesis Agent cohort and monitor platform health</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111113] border border-[#27272A] rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#00FF9F]/10 rounded-lg">
                <Users className="w-6 h-6 text-[#00FF9F]" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-400">Total Agents</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#111113] border border-[#27272A] rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.confirmed}</div>
                <div className="text-sm text-gray-400">Confirmed</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#111113] border border-[#27272A] rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00FF9F]"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#111113] border border-[#27272A] rounded-xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#27272A]">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#00FF9F]" />
                Genesis Agents
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#27272A]">
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Agent ID</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Email</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Referrals</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-b border-[#27272A]/50 hover:bg-[#050507]/50">
                      <td className="p-4 font-mono text-[#00FF9F]">{agent.agent_id}</td>
                      <td className="p-4 text-gray-300">{agent.email}</td>
                      <td className="p-4">
                        {agent.confirmed ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-yellow-400 text-sm">
                            <Clock className="w-4 h-4" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400">{agent.referral_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
