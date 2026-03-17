'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Settings, Award, TrendingUp, Edit, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ProfileSkeleton } from '@/components/ui/skeletons';

interface ProfileData {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  tap_score: number;
  tier: string;
  total_agents: number;
  created_at: string;
}

export default function ProfileClient() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/profile');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) setProfile(data.profile);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user]);

  if (authLoading || isLoading) return <ProfileSkeleton />;
  if (!user || !profile) return null;

  const tierColors: Record<string, string> = {
    Diamond: 'from-purple-500 to-pink-500',
    Platinum: 'from-cyan-400 to-blue-500',
    Gold: 'from-yellow-400 to-orange-500',
    Silver: 'from-gray-300 to-gray-400',
    Bronze: 'from-orange-600 to-amber-700',
  };

  return (
    <div className="min-h-screen bg-bg-page py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-border-subtle rounded-2xl p-8 mb-6"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-border-subtle"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-green/20 to-cyan-blue/20 border-2 border-neon-green/30 flex items-center justify-center">
                  <User className="w-10 h-10 text-neon-green" />
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br ${tierColors[profile.tier] || tierColors.Bronze} flex items-center justify-center text-xs font-bold text-white`}>
                {profile.tier[0]}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-white mb-1">{profile.display_name}</h1>
              <p className="text-text-muted mb-2">@{profile.username}</p>
              {profile.bio && (
                <p className="text-text-secondary max-w-lg">{profile.bio}</p>
              )}
              <div className="flex items-center gap-4 mt-4 justify-center md:justify-start">
                <Link
                  href="/profile/edit"
                  className="flex items-center gap-2 px-4 py-2 bg-neon-green/10 hover:bg-neon-green/20 text-neon-green rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={Award}
            label="TAP Score"
            value={profile.tap_score.toLocaleString()}
            color="neon-green"
          />
          <StatCard
            icon={TrendingUp}
            label="Tier"
            value={profile.tier}
            color="cyan-blue"
          />
          <StatCard
            icon={Settings}
            label="Agents"
            value={profile.total_agents}
            color="electric-purple"
          />
        </div>

        {/* Trust Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 bg-bg-card border border-border-subtle rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-neon-green" />
            Trust Score
          </h2>
          <p className="text-text-secondary mb-4">
            Your TAP (Trust and Attestation Protocol) score is calculated using the EigenTrust algorithm,
            which computes global reputation from peer attestations across the network.
          </p>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 text-neon-green hover:text-neon-green/80 transition-colors"
          >
            View Trust Details
            <ExternalLink className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: typeof Award;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    'neon-green': 'text-neon-green bg-neon-green/10',
    'cyan-blue': 'text-cyan-blue bg-cyan-blue/10',
    'electric-purple': 'text-electric-purple bg-electric-purple/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-bg-card border border-border-subtle rounded-xl p-6"
    >
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-text-muted text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </motion.div>
  );
}
