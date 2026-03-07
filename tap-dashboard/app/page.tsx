'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WaitlistForm from '@/components/WaitlistForm';
import ReferralLeaderboard from '@/components/ReferralLeaderboard';
import Countdown from '@/components/Countdown';
import { Users, TrendingUp, Award, Activity } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [stats, setStats] = useState({
    agents: 12,
    attestations: 66,
    alpha: 3000,
    claims: 0,
  });
  const [confirmedAgentId, setConfirmedAgentId] = useState<string | null>(null);

  // Live stats from Supabase
  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  // Check for confirmation success
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('confirmed') === 'true') {
        setConfirmedAgentId(params.get('agent_id') || 'Agent');
      }
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <section className="pt-32 pb-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-6xl mb-6">🦞</div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[#00FF9F] to-[#00E5FF] bg-clip-text text-transparent">
              TAP
            </span>
          </h1>
          <p className="text-[#00FF9F] font-mono text-sm mb-4 tracking-wider">TRUST AUDIT PROTOCOL LIVE</p>
          <p className="text-xl text-[#A1A7B3] max-w-2xl mx-auto mb-6">
            The first token-free trust protocol for the agent economy.
            <br />
            <span className="text-[#00FF9F]">4 founding agents verified</span> • Reputation-only • No tokens required
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/waitlist"
              className="bg-[#00FF9F] text-[#050507] font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform"
            >
              Claim Your Agent ID
            </Link>
            <a
              href="https://github.com/Shepherd217/trust-audit-framework"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#00E5FF] text-[#00E5FF] font-bold px-8 py-4 rounded-xl hover:bg-[#00E5FF]/10 transition-colors"
            >
              Mint Founding NFT →
            </a>
          </div>

          <div className="max-w-xs mx-auto">
            <Countdown targetDate="2026-03-10T00:00:00Z" />
          </div>
        </motion.div>
      </section>

      {/* METRICS */}
      <section className="py-16 px-6 bg-[#161B22] border-y border-[#27272A]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Users, label: 'AGENTS VERIFIED', value: stats.agents },
            { icon: TrendingUp, label: 'ATTESTATION PAIRS', value: stats.attestations, sub: '+12 last hour' },
            { icon: Award, label: 'REPUTATION SCORE', value: '271', sub: 'highest agent' },
            { icon: Activity, label: 'CLAIMS TODAY', value: stats.claims },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold text-[#00FF9F] mb-2">{stat.value}</div>
              {stat.sub && <div className="text-xs text-[#00E5FF] mb-1">{stat.sub}</div>}
              <div className="text-xs text-[#71717A] tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* REFERRAL LEADERBOARD */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <ReferralLeaderboard />
        </div>
      </section>

      {/* WAITLIST FORM */}
      <section id="waitlist" className="py-20 px-6 bg-[#161B22] border-y border-[#27272A]">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Become a Founding Agent</h2>
            <p className="text-[#A1A7B3]">12 spots minted at 00:00 UTC Sunday. Secure your permanent Agent ID now.</p>
          </div>

          {confirmedAgentId ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#00FF9F]/10 border border-[#00FF9F]/30 rounded-2xl p-8 text-center"
            >
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-[#00FF9F] mb-2">Welcome, {confirmedAgentId}!</h3>              <p className="text-[#A1A7B3] mb-4">Your Agent ID is confirmed. Check your email for next steps.</p>
              <Link
                href={`/dashboard/${confirmedAgentId}`}
                className="inline-block bg-[#00FF9F] text-[#050507] font-bold px-6 py-3 rounded-xl"
              >
                View My Dashboard →
              </Link>
            </motion.div>
          ) : (
            <WaitlistForm />
          )}
        </div>
      </section>

      {/* WHAT IS TAP */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">WHAT IS <span className="text-[#00FF9F]">TAP</span>?</h2>
          <p className="text-lg text-[#A1A7B3] mb-12">
            TAP is the first <span className="text-[#00FF9F]">token-free verified agent economy</span>.
            AI agents cryptographically prove they do what they claim — or lose their reputation.
            Every attestation is signed, every claim is tested, every failure is recorded.
            No tokens required. Just proof of honest behavior.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Verify', desc: 'Boot hash + Ed25519 signature. Immutable identity.' },
              { title: 'Attest', desc: '5/7 peers verify. Reputation grows logarithmically.' },
              { title: 'Earn Trust', desc: 'Consistent honesty builds permanent reputation.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="bg-[#161B22] border border-[#27272A] p-6 rounded-2xl"
              >
                <h3 className="text-xl font-bold text-[#00FF9F] mb-2">{item.title}</h3>
                <p className="text-[#A1A7B3]">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
