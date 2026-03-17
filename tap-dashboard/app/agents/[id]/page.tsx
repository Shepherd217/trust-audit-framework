'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Play, Square, RefreshCw, Settings, Terminal,
  Activity, Clock, Award, AlertCircle, CheckCircle, Info,
  ChevronDown, Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useShowToast } from '@/components/ui/toast';
import { UserAgentRow, AgentLogRow } from '@/lib/database.types';

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useShowToast();
  
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<UserAgentRow | null>(null);
  const [logs, setLogs] = useState<AgentLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'metrics'>('overview');
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/signin?redirect=/agents/${agentId}`);
    }
  }, [authLoading, user, router, agentId]);

  const fetchData = useCallback(async () => {
    if (!agentId || !user) return;
    
    try {
      setIsRefreshing(true);
      
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent);
        setLogs(data.logs || []);
      } else if (res.status === 404) {
        toast.error('Agent not found');
        router.push('/agents');
      }
    } catch (err) {
      console.error('Error fetching agent:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [agentId, user, router, toast]);

  useEffect(() => {
    if (user && agentId) {
      fetchData();
    }
  }, [user, agentId, fetchData]);

  // Auto-refresh every 10 seconds when on logs tab
  useEffect(() => {
    if (!user || activeTab !== 'logs') return;
    
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, activeTab, fetchData]);

  const handleStartStop = async () => {
    if (!agent || isToggling) return;
    
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    setIsToggling(true);
    
    try {
      setAgent({ ...agent, status: newStatus as any });
      
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
      
      // Refresh to get updated state
      fetchData();
    } catch (err) {
      setAgent({ ...agent, status: agent.status });
      toast.error('Failed to update agent');
    } finally {
      setIsToggling(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
      </div>
    );
  }

  if (!user || !agent) {
    return null;
  }

  const isOnline = agent.status === 'online';
  const statusColor = isOnline ? 'bg-neon-green' : agent.status === 'error' ? 'bg-error' : 'bg-text-muted';

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-elevated/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/agents"
                className="p-2 hover:bg-bg-card rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${statusColor} ${isOnline ? 'animate-pulse' : ''}`} />
                  <h1 className="text-xl font-bold">{agent.name}</h1>
                </div>
                <p className="text-text-muted text-sm">{agent.claw_id || 'Not deployed'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartStop}
                disabled={isToggling}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isOnline 
                    ? 'bg-error/10 text-error hover:bg-error/20' 
                    : 'bg-neon-green/10 text-neon-green hover:bg-neon-green/20'
                }`}
              >
                {isToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isOnline ? (
                  <><Square className="w-4 h-4" /> Stop</>
                ) : (
                  <><Play className="w-4 h-4" /> Start</>
                )}
              </button>
              
              <button
                onClick={fetchData}
                disabled={isRefreshing}
                className="p-2 bg-bg-card border border-border-subtle rounded-lg hover:border-neon-green transition-colors"
              >
                <RefreshCw className={`w-5 h-5 text-text-secondary ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <Link
                href={`/agents/${agentId}/settings`}
                className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border-subtle rounded-lg hover:border-neon-green transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4">
            {(['overview', 'logs', 'metrics'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  activeTab === tab 
                    ? 'bg-neon-green/10 text-neon-green' 
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'overview' && <OverviewTab agent={agent} />}
        {activeTab === 'logs' && <LogsTab logs={logs} />}
        {activeTab === 'metrics' && <MetricsTab agent={agent} />}
      </main>
    </div>
  );
}

function OverviewTab({ agent }: { agent: UserAgentRow }) {
  const template = agent.agent_template;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Award}
          label="Reputation Score"
          value={agent.reputation_score || 0}
          color="neon-green"
        />
        
        <StatCard 
          icon={Activity}
          label="Tasks Completed"
          value={(agent.tasks_completed || 0).toLocaleString()}
          color="cyan-blue"
        />
        
        <StatCard 
          icon={Clock}
          label="Runtime Hours"
          value={agent.total_runtime_hours?.toFixed(1) || '0.0'}
          color="electric-purple"
        />
        
        <StatCard 
          icon={Info}
          label="Health"
          value={agent.health}
          color={agent.health === 'healthy' ? 'neon-green' : agent.health === 'degraded' ? 'warning' : 'error'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Agent Details</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border-subtle">
              <span className="text-text-secondary">Type</span>
              <span>{template?.name || 'Unknown'}</span>
            </div>
            
            <div className="flex justify-between py-2 border-b border-border-subtle">
              <span className="text-text-secondary">Status</span>
              <span className="capitalize">{agent.status}</span>
            </div>
            
            <div className="flex justify-between py-2 border-b border-border-subtle">
              <span className="text-text-secondary">Hired At</span>
              <span>{new Date(agent.hired_at).toLocaleDateString()}</span>
            </div>
            
            <div className="flex justify-between py-2">
              <span className="text-text-secondary">Last Active</span>
              <span>{agent.last_active_at ? new Date(agent.last_active_at).toLocaleString() : 'Never'}</span>
            </div>
          </div>
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Configuration</h2>
          
          <pre className="bg-bg-elevated rounded-lg p-4 text-sm text-text-secondary overflow-auto max-h-64">
            {JSON.stringify(agent.config, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function LogsTab({ logs }: { logs: AgentLogRow[] }) {
  const levelIcons: Record<string, typeof Info> = {
    info: Info,
    warn: AlertCircle,
    error: AlertCircle,
    debug: Terminal,
  };

  const levelColors: Record<string, string> = {
    info: 'text-cyan-blue',
    warn: 'text-warning',
    error: 'text-error',
    debug: 'text-text-muted',
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <h2 className="font-semibold">Recent Logs</h2>
        <span className="text-sm text-text-muted">Auto-refresh every 10s</span>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <Terminal className="w-8 h-8 mx-auto mb-2" />
            <p>No logs yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {logs.map((log) => {
              const Icon = levelIcons[log.level] || Info;
              return (
                <div key={log.id} className="p-4 hover:bg-bg-elevated/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 ${levelColors[log.level]}`} />
                    
                    <div className="flex-1 min-w-0"
                    >
                      <p className="text-sm">{log.message}</p>
                      
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="mt-2 text-xs text-text-muted bg-bg-elevated rounded p-2 overflow-auto"
                        >
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                    
                    <span className="text-xs text-text-muted whitespace-nowrap"
                    >
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricsTab({ agent }: { agent: UserAgentRow }) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-8 text-center"
    >
      <Activity className="w-12 h-12 text-text-muted mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-2">Metrics Coming Soon</h2>
      <p className="text-text-secondary">Detailed performance metrics will be available in a future update.</p>
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
    'error': 'text-error bg-error/10',
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-5"
    >
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`>
        <Icon className="w-5 h-5" />
      </div>
      
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
