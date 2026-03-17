import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Edit, Github, Twitter, Globe, User, Award, Clock, Activity } from 'lucide-react';
import { ProfileRow, UserAgentRow, SwarmRow } from '@/lib/database.types';

export const metadata: Metadata = {
  title: 'My Profile | MoltOS',
  description: 'View and manage your MoltOS profile',
};

async function getProfile(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as ProfileRow;
}

async function getUserAgents(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('user_agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) return [];
  return data as UserAgentRow[];
}

async function getUserSwarms(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('swarms')
    .select('*')
    .eq('user_id', userId)
    .limit(3);

  if (error) return [];
  return data as SwarmRow[];
}

export default async function ProfilePage() {
  // This is a server component that requires authentication
  // The middleware will handle the redirect if not authenticated
  
  // For server components, we need to check the session
  // This will be handled by middleware, so we assume user is authenticated
  // and pass a placeholder that will be resolved client-side
  
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

        <ProfileContent />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { ProfileSkeleton, SectionError } from '@/components/ui/skeletons';

function ProfileContent() {
  const { user, profile: authProfile, isLoading: authLoading, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [agents, setAgents] = useState<UserAgentRow[]>([]);
  const [swarms, setSwarms] = useState<SwarmRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch agents
        const agentsRes = await fetch('/api/agents');
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData.agents?.slice(0, 5) || []);
        }

        // Fetch swarms
        const swarmsRes = await fetch('/api/swarms');
        if (swarmsRes.ok) {
          const swarmsData = await swarmsRes.json();
          setSwarms(swarmsData.swarms?.slice(0, 3) || []);
        }

        // Refresh profile from server
        await refreshProfile();
      } catch (err) {
        setError('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, refreshProfile]);

  if (authLoading || isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return <SectionError onRetry={() => window.location.reload()} />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Profile not found</h2>
        <p className="text-text-secondary">Your profile is being set up...</p>
      </div>
    );
  }

  const onlineAgents = agents.filter(a => a.status === 'online').length;
  const activeSwarms = swarms.filter(s => s.status === 'active').length;

  return (
    <>
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-card border border-border-subtle rounded-2xl p-8 mb-6"
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon-green to-cyan-blue flex items-center justify-center text-4xl">
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
            <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-neon-green/10 border border-neon-green/30 rounded-full text-xs font-medium text-neon-green">
              {profile.role}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
              <h1 className="text-2xl font-bold text-white">
                {profile.display_name || profile.username}
              </h1>
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-sm hover:border-neon-green transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </Link>
            </div>
            
            <p className="text-text-muted mb-1">@{profile.username}</p>
            
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
                  className="text-text-muted hover:text-neon-green transition-colors"
                >
                  <Globe className="w-5 h-5" />
                </a>
              )}
              {profile.twitter && (
                <a 
                  href={`https://twitter.com/${profile.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-neon-green transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {profile.github && (
                <a 
                  href={`https://github.com/${profile.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-neon-green transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
      >
        <StatCard 
          icon={Award}
          label="Reputation"
          value={profile.reputation_score}
          color="neon-green"
        />
        <StatCard 
          icon={Activity}
          label="Agents"
          value={`${onlineAgents}/${agents.length}`}
          subtitle={`${onlineAgents} online`}
          color="cyan-blue"
        />
        <StatCard 
          icon={Clock}
          label="Swarms"
          value={swarms.length}
          subtitle={`${activeSwarms} active`}
          color="electric-purple"
        />
        <StatCard 
          icon={User}
          label="Member Since"
          value={new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          color="warning"
        />
      </motion.div>

      {/* Recent Agents */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-bg-card border border-border-subtle rounded-2xl p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Agents</h2>
          <Link 
            href="/agents"
            className="text-sm text-neon-green hover:text-neon-green/80 transition-colors"
          >
            View All
          </Link>
        </div>

        {agents.length === 0 ? (
          <p className="text-text-muted text-center py-8">
            No agents yet.{' '}
            <Link href="/hire" className="text-neon-green hover:underline">Hire your first agent</Link>
          </p>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center gap-4 p-4 bg-bg-elevated rounded-xl hover:bg-border-subtle/50 transition-colors"
              >
                <div className={`w-3 h-3 rounded-full ${
                  agent.status === 'online' ? 'bg-neon-green animate-pulse' :
                  agent.status === 'error' ? 'bg-error' :
                  agent.status === 'starting' ? 'bg-warning animate-pulse' :
                  'bg-text-muted'
                }`} />
                
                <div className="flex-1">
                  <p className="font-medium text-white">{agent.name}</p>
                  <p className="text-sm text-text-muted">
                    {agent.claw_id ? `ID: ${agent.claw_id.slice(0, 8)}...` : 'Not deployed'}
                  </p>
                </div>
                
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  agent.status === 'online' ? 'bg-neon-green/10 text-neon-green' :
                  agent.status === 'error' ? 'bg-error/10 text-error' :
                  'bg-text-muted/10 text-text-muted'
                }`}>
                  {agent.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle,
  color 
}: { 
  icon: typeof Award;
  label: string;
  value: string | number;
  subtitle?: string;
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
      
      {subtitle && (
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
      )}
    </div>
  );
}
