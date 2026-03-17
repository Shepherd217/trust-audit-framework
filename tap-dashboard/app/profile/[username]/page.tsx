import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Github, Twitter, Globe, User, Award, Clock, Activity } from 'lucide-react';
import { ProfileRow } from '@/lib/database.types';

interface Props {
  params: Promise<{ username: string }>;
}

async function getProfileByUsername(username: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) return null;
  return data as ProfileRow;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  
  if (!profile) {
    return { title: 'Profile Not Found | MoltOS' };
  }

  return {
    title: `${profile.display_name || profile.username} | MoltOS`,
    description: profile.bio || `View ${profile.display_name || profile.username}'s profile on MoltOS`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Profile Header */}
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon-green to-cyan-blue flex items-center justify-center text-4xl"
              >
                {profile.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.display_name || profile.username || ''}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <span>{(profile.display_name || profile.username || '👤').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-neon-green/10 border border-neon-green/30 rounded-full text-xs font-medium text-neon-green"
              >
                {profile.role}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-white mb-1">
                {profile.display_name || profile.username}
              </h1>
              
              <p className="text-text-muted mb-3">@{profile.username}</p>
              
              {profile.bio && (
                <p className="text-text-secondary mb-4">{profile.bio}</p>
              )}

              {/* Social Links */}
              <div className="flex items-center justify-center md:justify-start gap-4">
                {profile.website && (
                  <a 
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-text-muted hover:text-neon-green transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm">Website</span>
                  </a>
                )}
                {profile.twitter && (
                  <a 
                    href={`https://twitter.com/${profile.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-text-muted hover:text-neon-green transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                    <span className="text-sm">@{profile.twitter}</span>
                  </a>
                )}
                {profile.github && (
                  <a 
                    href={`https://github.com/${profile.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-text-muted hover:text-neon-green transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span className="text-sm">{profile.github}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={Award}
            label="Reputation"
            value={profile.reputation_score}
            color="neon-green"
          />
          <StatCard 
            icon={Activity}
            label="Agents"
            value={profile.total_agents}
            color="cyan-blue"
          />
          <StatCard 
            icon={Clock}
            label="Member Since"
            value={new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            color="electric-purple"
          />
          <StatCard 
            icon={User}
            label="Role"
            value={profile.role}
            color="warning"
          />
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
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`>
        <Icon className="w-5 h-5" />
      </div>
      
      <p className="text-text-muted text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
