'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Share2, Activity } from 'lucide-react';

interface Stats {
  agents: number;
  totalSignups: number;
  attestations: number;
  alpha: number;
  claims: number;
  referrals: number;
}

export default function Stats() {
  const [stats, setStats] = useState<Stats>({
    agents: 12,
    totalSignups: 12,
    attestations: 66,
    alpha: 3000,
    claims: 0,
    referrals: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { icon: Users, label: 'Total Signups', value: stats.totalSignups, color: 'text-[#00FF9F]' },
    { icon: Activity, label: 'Confirmed Agents', value: stats.agents, color: 'text-[#00E5FF]' },
    { icon: Share2, label: 'Total Referrals', value: stats.referrals, color: 'text-[#9D4EDD]' },
    { icon: TrendingUp, label: 'Attestation Pairs', value: stats.attestations, color: 'text-[#FFB800]' },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Live Agent Network <span className="text-[#00FF9F]">Analytics</span>
          </h1>
          <p className="text-[#A1A7B3]">Real-time stats from the TAP waitlist</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 text-center"
            >
              <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-4`} />
              <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
              <div className="text-sm text-[#71717A]">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">Network Growth</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#050507] rounded-xl">
              <span className="text-[#A1A7B3]">Average Position Boost</span>
              <span className="text-[#00FF9F] font-bold">-5 positions per 3 referrals</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-[#050507] rounded-xl">
              <span className="text-[#A1A7B3]">Confirmation Rate</span>
              <span className="text-[#00E5FF] font-bold">Coming soon</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-[#050507] rounded-xl">
              <span className="text-[#A1A7B3]">Launch Date</span>
              <span className="text-[#FFB800] font-bold">2026-03-10 00:00 UTC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
