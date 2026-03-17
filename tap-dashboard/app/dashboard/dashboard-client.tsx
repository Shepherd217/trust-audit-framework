'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Play, Square, FileText, Users, Activity, Shield, TrendingUp,
  Clock, Award, AlertCircle, Search, Filter, RefreshCw, Zap,
  Globe, Plus, MoreVertical, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSkeleton, SectionError, ButtonLoader } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';
import { UserAgentRow, SwarmRow } from '@/lib/database.types';

export default function DashboardClient() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useShowToast();
  
  const [agents, setAgents] = useState<UserAgentRow[]>([]);
  const [swarms, setSwarms] = useState<SwarmRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsRefreshing(true);
      setError(null);
      
      // Get auth token
      const { data: { session } } = await fetch('/api/auth/session').then(r => r.json()).catch(() => ({ data: { session: null } }));
      const token = session?.access_token;
      
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch agents
      const agentsRes = await fetch('/api/agents', { headers });
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.agents || []);
      }

      // Fetch swarms
      const swarmsRes = await fetch('/api/swarms', { headers });
      if (swarmsRes.ok) {
        const swarmsData = await swarmsRes.json();
        setSwarms(swarmsData.swarms || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  const handleStartStop = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'online' ? 'offline' : 'online';
    
    try {
      // Optimistic update
      setAgents(prev => prev.map(a => 
        a.id === agentId ? { ...a, status: newStatus as any } : a
      ));

      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update agent');
      }

      toast.success(
        newStatus === 'online' ? 'Agent started' : 'Agent stopped',
        `Agent is now ${newStatus}`
      );
    } catch (err) {
      // Revert on error
      setAgents(prev => prev.map(a => 
        a.id === agentId ? { ...a, status: currentStatus as any } : a
      ));
      toast.error('Failed to update agent', 'Please try again');
    }
  };

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.claw_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const onlineAgents = agents.filter(a => a.status === 'online').length;
  const totalAgents = agents.length;
  const avgReputation = agents.length > 0 
    ? Math.round(agents.reduce((acc, a) => acc + (a.reputation_score || 0), 0) / agents.length)
    : 0;
  const activeSwarms = swarms.filter(s => s.status === 'active').length;

  if (authLoading || (isLoading && agents.length === 0)) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null; // Will redirect
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <SectionError 
          retry={fetchData}
          message={error}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-elevated/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green to-cyan-blue flex items-center justify-center">
                <Activity className="w-5 h-5 text-bg-page" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Dashboard</h1>
                <p className="text-text-secondary text-sm">Manage your AI agent fleet</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm focus:border-neon-green focus:outline-none transition-colors"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm focus:border-neon-green focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="error">Error</option>
              </select>
              
              <button
                onClick={fetchData}
                disabled={isRefreshing}
                className="p-2 bg-bg-card border border-border-subtle rounded-lg hover:border-neon-green transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-text-secondary ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <Link
                href="/hire"
                className="flex items-center gap-2 px-4 py-2 bg-neon-green text-bg-page font-semibold rounded-lg hover:bg-neon-green/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Hire Agent</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Overview */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Total Agents"
            value={totalAgents}
            subtitle={`${onlineAgents} online`}
            color="neon-green"
          />
          
          <StatCard
            icon={Award}
            label="Avg Reputation"
            value={avgReputation}
            trend="+3.2%"
            color="cyan-blue"
          />
          
          <StatCard
            icon={Users}
            label="Active Swarms"
            value={`${activeSwarms}/${swarms.length}`}
            color="electric-purple"
          />
          
          <StatCard
            icon={Zap}
            label="Tasks Today"
            value={agents.reduce((acc, a) => acc + (a.tasks_completed || 0), 0).toLocaleString()}
            color="warning"
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Agent List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-neon-green" />
                Your Agents
              </h2>
              
              <Link 
                href="/agents"
                className="text-sm text-neon-green hover:text-neon-green/80 transition-colors flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {filteredAgents.length === 0 ? (
              <div className="bg-bg-card border border-border-subtle rounded-xl p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neon-green/10 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-neon-green" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No agents yet</h3>
                <p className="text-text-secondary mb-6">
                  {searchQuery 
                    ? 'No agents match your search'
                    : 'Hire your first agent to get started'}
                </p>
                {!searchQuery && (
                  <Link
                    href="/hire"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Hire Agent
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAgents.map((agent) => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent}
                    onStartStop={handleStartStop}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-neon-green/5 to-cyan-blue/5 border border-neon-green/20 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <QuickActionButton 
                  href="/hire"
                  icon={Plus}
                  label="Hire New Agent"
                />
                <QuickActionButton 
                  href="/agents"
                  icon={Users}
                  label="Manage Agents"
                />
                
                <QuickActionButton 
                  href="/profile"
                  icon={Activity}
                  label="View Profile"
                />
              </div>
            </div>

            {/* Active Swarms */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Your Swarms</h3>
                <span className="text-xs text-text-muted">{swarms.length} total</span>
              </div>

              {swarms.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4">
                  No swarms yet
                </p>
              ) : (
                <div className="space-y-3">
                  {swarms.slice(0, 4).map((swarm) => (
                    <Link
                      key={swarm.id}
                      href={`/swarms/${swarm.id}`}
                      className="block p-4 bg-bg-elevated rounded-xl hover:bg-border-subtle/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">{swarm.name}</p>
                          <p className="text-xs text-text-muted">{swarm.region || 'Global'}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          swarm.status === 'active' 
                            ? 'bg-neon-green/10 text-neon-green' 
                            : 'bg-text-muted/10 text-text-muted'
                        }`}>
                          {swarm.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        <span>{swarm.agent_ids.length} agents</span>
                        <span>{swarm.throughput_per_min}/min</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle,
  trend,
  color 
}: { 
  icon: typeof Users;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    'neon-green': { bg: 'bg-neon-green/10', text: 'text-neon-green' },
    'cyan-blue': { bg: 'bg-cyan-blue/10', text: 'text-cyan-blue' },
    'electric-purple': { bg: 'bg-electric-purple/10', text: 'text-electric-purple' },
    'warning': { bg: 'bg-warning/10', text: 'text-warning' },
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 relative overflow-hidden group hover:border-border-active/50 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 mt-1">
              {trend && (
                <span className="text-neon-green text-xs">{trend}</span>
              )}
              {subtitle && (
                <span className="text-text-muted text-xs">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        
        <div className={`p-2.5 rounded-lg ${colorClasses[color].bg}`}>
          <Icon className={`w-5 h-5 ${colorClasses[color].text}`} />
        </div>
      </div>
    </div>
  );
}

function AgentCard({ 
  agent, 
  onStartStop 
}: { 
  agent: UserAgentRow;
  onStartStop: (id: string, status: string) => void;
}) {
  const statusColors: Record<string, string> = {
    online: 'bg-neon-green',
    offline: 'bg-text-muted',
    error: 'bg-error',
    starting: 'bg-warning',
    stopping: 'bg-warning',
  };

  const statusBgColors: Record<string, string> = {
    online: 'bg-neon-green/10 text-neon-green border-neon-green/30',
    offline: 'bg-text-muted/10 text-text-muted border-text-muted/30',
    error: 'bg-error/10 text-error border-error/30',
    starting: 'bg-warning/10 text-warning border-warning/30',
    stopping: 'bg-warning/10 text-warning border-warning/30',
  };

  const isOnline = agent.status === 'online';
  const healthColors: Record<string, string> = {
    healthy: 'bg-neon-green',
    degraded: 'bg-warning',
    critical: 'bg-error',
    unknown: 'bg-text-muted',
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 hover:border-border-active/50 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[agent.status]} ${isOnline ? 'animate-pulse' : ''}`} />
          <div>
            <Link 
              href={`/agents/${agent.id}`}
              className="font-semibold hover:text-neon-green transition-colors"
            >
              {agent.name}
            </Link>
            <p className="text-text-muted text-xs">
              {agent.last_active_at 
                ? `Active ${new Date(agent.last_active_at).toLocaleDateString()}`
                : 'Never active'}
            </p>
          </div>
        </div>
        
        <span className={`text-xs px-2 py-1 rounded-full border ${statusBgColors[agent.status]}`}>
          {agent.status}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-text-muted text-xs mb-1">Reputation</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{agent.reputation_score || 0}</span>
            <div className="w-12 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-green to-cyan-blue rounded-full"
                style={{ width: `${Math.min((agent.reputation_score || 0), 100)}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-text-muted text-xs mb-1">Tasks</p>
          <p className="font-semibold">{(agent.tasks_completed || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onStartStop(agent.id, agent.status)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            isOnline 
              ? 'bg-error/10 text-error hover:bg-error/20' 
              : 'bg-neon-green/10 text-neon-green hover:bg-neon-green/20'
          }`}
        >
          {isOnline ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isOnline ? 'Stop' : 'Start'}
        </button>
        
        <Link
          href={`/agents/${agent.id}`}
          className="p-2 bg-bg-elevated rounded-lg hover:bg-border-subtle transition-colors"
        >
          <FileText className="w-4 h-4 text-text-secondary" />
        </Link>
        
        <Link
          href={`/agents/${agent.id}/settings`}
          className="p-2 bg-bg-elevated rounded-lg hover:bg-border-subtle transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-text-secondary" />
        </Link>
      </div>
    </div>
  );
}

function QuickActionButton({ 
  href, 
  icon: Icon, 
  label 
}: { 
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 w-full p-3 bg-bg-card border border-border-subtle rounded-lg hover:border-neon-green/50 transition-colors"
    >
      <Icon className="w-4 h-4 text-neon-green" />
      <span className="text-sm">{label}</span>
    </Link>
  );
}
