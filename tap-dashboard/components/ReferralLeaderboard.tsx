'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface Leader {
  agent_id: string;
  referral_count: number;
  position: number;
  boosted?: number;
}

export default function ReferralLeaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        // Calculate boosted positions
        const withBoost = data.map((l: any, i: number) => ({
          ...l,
          position: i + 1,
          boosted: Math.max(1, i + 1 - Math.floor(l.referral_count / 3) * 5)
        }));
        setLeaders(withBoost);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 text-center">
        <p className="text-[#71717A]">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-[#00FF9F]" />
        <h3 className="text-xl font-bold">Referral Leaderboard</h3>
      </div>

      {leaders.length === 0 ? (
        <p className="text-[#71717A] text-center py-4">No referrals yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {leaders.slice(0, 10).map((leader, i) => (
            <motion.div
              key={leader.agent_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between p-3 bg-[#050507] rounded-xl"
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                  i === 0 ? 'bg-[#FFD700] text-black' :
                  i === 1 ? 'bg-[#C0C0C0] text-black' :
                  i === 2 ? 'bg-[#CD7F32] text-white' :
                  'bg-[#27272A] text-white'
                }`}>
                  {i + 1}
                </span>
                <span className="font-mono text-[#00E5FF]">{leader.agent_id}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#00FF9F]">{leader.referral_count} referrals</div>
                <div className="text-xs text-[#71717A]">Boosted #{leader.boosted}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
