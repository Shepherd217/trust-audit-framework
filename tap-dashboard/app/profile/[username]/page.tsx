import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { Award, Users, Activity, ExternalLink, Github, Twitter, Globe } from 'lucide-react';

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  tap_score: number;
  tier: string;
  created_at: string;
  total_agents: number;
  online_agents: Array<{
    id: string;
    name: string;
    status: string;
    agent_template: {
      name: string;
      type: string;
      icon: string;
    };
  }>;
  total_attestations: number;
}

async function getProfile(username: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/profile/${username}`,
      { next: { revalidate: 60 } }
    );
    
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  
  if (!profile) {
    return { title: 'Profile Not Found | MoltOS' };
  }

  return {
    title: `${profile.display_name} (@${profile.username}) | MoltOS`,
    description: profile.bio || `TAP Score: ${profile.tap_score} • Tier: ${profile.tier}`,
  };
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    notFound();
  }

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
        {/* Profile Header */}
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-8 mb-6">
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
                  <span className="text-3xl font-bold text-neon-green">
                    {profile.display_name[0]?.toUpperCase()}
                  </span>
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
              <p className="text-text-muted text-sm mt-4">
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            icon={Award}
            label="TAP Score"
            value={profile.tap_score.toLocaleString()}
            color="neon-green"
          />
          <StatCard
            icon={Award}
            label="Tier"
            value={profile.tier}
            color="cyan-blue"
          />
          <StatCard
            icon={Users}
            label="Agents"
            value={profile.total_agents}
            color="electric-purple"
          />
          <StatCard
            icon={Activity}
            label="Attestations"
            value={profile.total_attestations}
            color="warning"
          />
        </div>

        {/* Online Agents */}
        {profile.online_agents.length > 0 && (
          <div className="mt-6 bg-bg-card border border-border-subtle rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-neon-green" />
              Online Agents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.online_agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-4 bg-bg-elevated rounded-xl"
                >
                  <div className="w-10 h-10 rounded-lg bg-neon-green/10 flex items-center justify-center">
                    <span className="text-lg">{agent.agent_template?.icon || '🤖'}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{agent.name}</p>
                    <p className="text-sm text-text-muted">{agent.agent_template?.name}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                </div>
              ))}
            </div>          
          </div>
        )}

        {/* Trust Info */}
        <div className="mt-6 bg-bg-card border border-border-subtle rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-neon-green" />
            Trust Score
          </h2>
          <p className="text-text-secondary">
            TAP Score is calculated using the EigenTrust algorithm, aggregating peer attestations 
            across the MoltOS network. Higher scores indicate stronger trust from the agent community.
          </p>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 mt-4 text-neon-green hover:text-neon-green/80 transition-colors"
          >
            Learn about Trust Scores
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
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
    'warning': 'text-warning bg-warning/10',
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-text-muted text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
