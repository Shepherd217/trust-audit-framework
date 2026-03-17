'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Plus, Search, Filter, Play, Square, MoreVertical,
  ArrowRight, RefreshCw, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DashboardSkeleton, SectionError } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';
import { UserAgentRow } from '@/lib/database.types';

export default function AgentsListClient() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useShowToast();
  
  const [agents, setAgents] = useState<UserAgentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/agents');
    }
  }, [authLoading, user, router]);

  const fetchAgents = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsRefreshing(true);
      
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAgents();
    }
  }, [user, fetchAgents]);

  const handleStartStop = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'online' ? 'offline' : 'online';
    
    try {
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
      setAgents(prev => prev.map(a => 
        a.id === agentId ? { ...a, status: currentStatus as any } : a
      ));
      toast.error('Failed to update agent');
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.claw_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-page">
      <header className="border-b border-border-subtle bg-bg-elevated/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Your Agents</h1>
              <p className="text-text-secondary text-sm">{agents.length} agents in your fleet</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm focus:border-neon-green focus:outline-none transition-colors w-full sm:w-64"
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
                onClick={fetchAgents}
                disabled={isRefreshing}
                className="p-2 bg-bg-card border border-border-subtle rounded-lg hover:border-neon-green transition-colors"
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
        {filteredAgents.length === 0 ? (
          <div className="bg-bg-card border border-border-subtle rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neon-green/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-neon-green" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No agents found</h2>
            <p className="text-text-secondary mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by hiring your first agent'}
            </p>
            <Link
              href="/hire"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Hire Your First Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent}
                onStartStop={handleStartStop}
              />
            ))}
          </div>
        )}
      </main>
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
  const statusColors: Record<string, { dot: string; bg: string }> = {
    online: { dot: 'bg-neon-green', bg: 'bg-neon-green/10 text-neon-green border-neon-green/30' },
    offline: { dot: 'bg-text-muted', bg: 'bg-text-muted/10 text-text-muted border-text-muted/30' },
    error: { dot: 'bg-error', bg: 'bg-error/10 text-error border-error/30' },
    starting: { dot: 'bg-warning', bg: 'bg-warning/10 text-warning border-warning/30' },
    stopping: { dot: 'bg-warning', bg: 'bg-warning/10 text-warning border-warning/30' },
  };

  const isOnline = agent.status === 'online';
  const colors = statusColors[agent.status] || statusColors.offline;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-card border border-border-subtle rounded-xl p-5 hover:border-border-active/50 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${colors.dot} ${isOnline ? 'animate-pulse' : ''}`} />
          <div>
            <Link 
              href={`/agents/${agent.id}`}
              className="font-semibold hover:text-neon-green transition-colors"
            >
              {agent.name}
            </Link>
            <p className="text-text-muted text-xs">
              {agent.claw_id ? agent.claw_id.slice(0, 16) + '...' : 'Not deployed'}
            </p>
          </div>
        </div>
        
        <span className={`text-xs px-2 py-1 rounded-full border ${colors.bg}`}>
          {agent.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-text-muted text-xs mb-1">Reputation</p>
          <p className="font-semibold">{agent.reputation_score || 0}</p>
        </div>
        
        <div>
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
          className="px-4 py-2 bg-bg-elevated rounded-lg hover:bg-border-subtle transition-colors text-sm"
        >
          Details
        </Link>
        
        <Link
          href={`/agents/${agent.id}/settings`}
          className="p-2 bg-bg-elevated rounded-lg hover:bg-border-subtle transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-text-secondary" />
        </Link>
      </div>
    </motion.div>
  );
}
