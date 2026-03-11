'use client';

import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  FileText, 
  Users, 
  Activity, 
  Shield, 
  TrendingUp,
  Clock,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Search,
  Filter,
  RefreshCw,
  Zap,
  Globe
} from 'lucide-react';

// Types
interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  reputation: number;
  health: 'healthy' | 'degraded' | 'critical';
  lastActive: string;
  tasksCompleted: number;
}

interface Swarm {
  id: string;
  name: string;
  agents: number;
  status: 'active' | 'idle' | 'error';
  throughput: string;
  region: string;
}

interface Dispute {
  id: string;
  agent: string;
  type: string;
  status: 'pending' | 'resolved' | 'rejected';
  filedAt: string;
  outcome?: string;
}

// Mock Data
const mockAgents: Agent[] = [
  { id: '1', name: 'Alpha-1', status: 'online', reputation: 94, health: 'healthy', lastActive: '2 min ago', tasksCompleted: 1247 },
  { id: '2', name: 'Beta-7', status: 'online', reputation: 88, health: 'healthy', lastActive: '5 min ago', tasksCompleted: 982 },
  { id: '3', name: 'Gamma-3', status: 'warning', reputation: 76, health: 'degraded', lastActive: '15 min ago', tasksCompleted: 654 },
  { id: '4', name: 'Delta-9', status: 'online', reputation: 91, health: 'healthy', lastActive: '1 min ago', tasksCompleted: 1103 },
  { id: '5', name: 'Epsilon-2', status: 'offline', reputation: 45, health: 'critical', lastActive: '2 hours ago', tasksCompleted: 423 },
  { id: '6', name: 'Zeta-5', status: 'online', reputation: 82, health: 'healthy', lastActive: '8 min ago', tasksCompleted: 789 },
];

const mockSwarms: Swarm[] = [
  { id: '1', name: 'Processing Swarm A', agents: 12, status: 'active', throughput: '1.2k/min', region: 'US-East' },
  { id: '2', name: 'Validation Swarm B', agents: 8, status: 'active', throughput: '850/min', region: 'EU-West' },
  { id: '3', name: 'Inference Swarm C', agents: 15, status: 'idle', throughput: '0/min', region: 'AP-South' },
  { id: '4', name: 'Consensus Swarm D', agents: 6, status: 'active', throughput: '420/min', region: 'US-West' },
];

const mockDisputes: Dispute[] = [
  { id: 'DSP-001', agent: 'Alpha-1', type: 'Attestation Conflict', status: 'resolved', filedAt: '2 hours ago', outcome: 'Agent Cleared' },
  { id: 'DSP-002', agent: 'Beta-7', type: 'Timeout Violation', status: 'pending', filedAt: '4 hours ago' },
  { id: 'DSP-003', agent: 'Gamma-3', type: 'Reputation Challenge', status: 'rejected', filedAt: '1 day ago', outcome: 'Challenge Failed' },
  { id: 'DSP-004', agent: 'Delta-9', type: 'Data Discrepancy', status: 'resolved', filedAt: '2 days ago', outcome: 'Penalty Applied' },
  { id: 'DSP-005', agent: 'Zeta-5', type: 'Consensus Failure', status: 'pending', filedAt: '5 hours ago' },
];

// Reputation data for the last 30 days
const reputationHistory = [
  { day: 1, score: 85 }, { day: 3, score: 87 }, { day: 5, score: 86 },
  { day: 7, score: 88 }, { day: 9, score: 89 }, { day: 11, score: 88 },
  { day: 13, score: 90 }, { day: 15, score: 91 }, { day: 17, score: 90 },
  { day: 19, score: 92 }, { day: 21, score: 93 }, { day: 23, score: 92 },
  { day: 25, score: 94 }, { day: 27, score: 93 }, { day: 29, score: 95 },
  { day: 30, score: 94 },
];

// Milestones
const milestones = [
  { score: 100, label: 'Genesis', color: '#FFD700' },
  { score: 90, label: 'Elite', color: '#00E5FF' },
  { score: 75, label: 'Trusted', color: '#00FF9F' },
  { score: 50, label: 'Verified', color: '#FFB800' },
  { score: 25, label: 'Novice', color: '#A1A7B3' },
];

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const onlineAgents = mockAgents.filter(a => a.status === 'online').length;
  const totalAgents = mockAgents.length;
  const avgReputation = Math.round(mockAgents.reduce((acc, a) => acc + a.reputation, 0) / totalAgents);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-neon-green';
      case 'degraded': return 'bg-warning';
      case 'critical': return 'bg-error';
      default: return 'bg-text-muted';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'resolved': return 'text-neon-green';
      case 'warning':
      case 'idle':
      case 'pending': return 'text-warning';
      case 'offline':
      case 'error':
      case 'rejected': return 'text-error';
      default: return 'text-text-muted';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'resolved': return 'bg-neon-green/10 border-neon-green/30';
      case 'warning':
      case 'idle':
      case 'pending': return 'bg-warning/10 border-warning/30';
      case 'offline':
      case 'error':
      case 'rejected': return 'bg-error/10 border-error/30';
      default: return 'bg-text-muted/10 border-text-muted/30';
    }
  };

  // Simple SVG line chart for reputation
  const renderReputationChart = () => {
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxScore = 100;
    const minScore = 70;
    const scoreRange = maxScore - minScore;

    const points = reputationHistory.map((d, i) => {
      const x = padding.left + (i / (reputationHistory.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.score - minScore) / scoreRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `${points} ${padding.left + chartWidth},${padding.top + chartHeight} ${padding.left},${padding.top + chartHeight}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((percent) => {
          const y = padding.top + chartHeight - (percent / 100) * chartHeight;
          return (
            <line
              key={percent}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#27272A"
              strokeDasharray="4"
            />
          );
        })}

        {/* Y-axis labels */}
        {[100, 90, 80, 70].map((score, i) => {
          const y = padding.top + (i / 3) * chartHeight;
          return (
            <text
              key={score}
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fill="#71717A"
              fontSize="12"
            >
              {score}
            </text>
          );
        })}

        {/* X-axis labels */}
        <text x={padding.left} y={height - 10} fill="#71717A" fontSize="12">Day 1</text>
        <text x={width / 2} y={height - 10} textAnchor="middle" fill="#71717A" fontSize="12">Day 15</text>
        <text x={width - padding.right} y={height - 10} textAnchor="end" fill="#71717A" fontSize="12">Day 30</text>

        {/* Milestone lines */}
        {milestones.filter(m => m.score >= minScore).map((milestone) => {
          const y = padding.top + chartHeight - ((milestone.score - minScore) / scoreRange) * chartHeight;
          return (
            <g key={milestone.score}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={milestone.color}
                strokeWidth="1"
                strokeDasharray="6"
                opacity="0.5"
              />
              <text
                x={width - padding.right + 5}
                y={y + 4}
                fill={milestone.color}
                fontSize="10"
                opacity="0.8"
              >
                {milestone.label}
              </text>
            </g>
          );
        })}

        {/* Area under line */}
        <polygon
          points={areaPoints}
          fill="url(#gradient)"
          opacity="0.3"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#00FF9F"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {reputationHistory.map((d, i) => {
          const x = padding.left + (i / (reputationHistory.length - 1)) * chartWidth;
          const y = padding.top + chartHeight - ((d.score - minScore) / scoreRange) * chartHeight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="#050507"
              stroke="#00FF9F"
              strokeWidth="2"
            />
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00FF9F" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#00FF9F" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-elevated/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green to-cyan-blue flex items-center justify-center">
                <Activity className="w-5 h-5 text-bg-page" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Agent Dashboard</h1>
                <p className="text-text-secondary text-sm">Monitor and manage your AI agent fleet</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-cyan-blue transition-colors w-64"
                />
              </div>
              <button className="p-2 hover:bg-bg-card rounded-lg transition-colors">
                <Filter className="w-5 h-5 text-text-secondary" />
              </button>
              <button className="p-2 hover:bg-bg-card rounded-lg transition-colors">
                <RefreshCw className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-bg-card border border-border-subtle rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/5 rounded-full blur-3xl group-hover:bg-neon-green/10 transition-all" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-text-secondary text-sm mb-1">Total Agents</p>
                <p className="text-3xl font-bold">{totalAgents}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-neon-green text-sm">{onlineAgents} online</span>
                  <span className="text-text-muted text-sm">•</span>
                  <span className="text-error text-sm">{totalAgents - onlineAgents} offline</span>
                </div>
              </div>
              <div className="p-3 bg-neon-green/10 rounded-lg">
                <Users className="w-6 h-6 text-neon-green" />
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-blue/5 rounded-full blur-3xl group-hover:bg-cyan-blue/10 transition-all" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-text-secondary text-sm mb-1">Avg. Reputation</p>
                <p className="text-3xl font-bold">{avgReputation}</p>
                <div className="flex items-center gap-2 mt-2">
                  <TrendingUp className="w-4 h-4 text-neon-green" />
                  <span className="text-neon-green text-sm">+3.2% this week</span>
                </div>
              </div>
              <div className="p-3 bg-cyan-blue/10 rounded-lg">
                <Award className="w-6 h-6 text-cyan-blue" />
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-electric-purple/5 rounded-full blur-3xl group-hover:bg-electric-purple/10 transition-all" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-text-secondary text-sm mb-1">Attestations</p>
                <p className="text-3xl font-bold">24.8K</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-cyan-blue text-sm">98.4% success rate</span>
                </div>
              </div>
              <div className="p-3 bg-electric-purple/10 rounded-lg">
                <Shield className="w-6 h-6 text-electric-purple" />
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-border-subtle rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full blur-3xl group-hover:bg-warning/10 transition-all" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-text-secondary text-sm mb-1">Network Uptime</p>
                <p className="text-3xl font-bold">99.97%</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-warning text-sm">Rank #12 globally</span>
                </div>
              </div>
              <div className="p-3 bg-warning/10 rounded-lg">
                <Globe className="w-6 h-6 text-warning" />
              </div>
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Agent Cards & Swarms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Agent Status Cards */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-neon-green" />
                  Agent Fleet
                </h2>
                <button className="text-sm text-cyan-blue hover:text-cyan-blue/80 transition-colors">
                  View All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`bg-bg-card border rounded-xl p-5 transition-all cursor-pointer hover:border-cyan-blue/50 ${
                      selectedAgent === agent.id ? 'border-cyan-blue shadow-glow-cyan' : 'border-border-subtle'
                    }`}
                    onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getHealthColor(agent.health)} ${agent.status === 'online' ? 'animate-pulse' : ''}`} />
                        <div>
                          <h3 className="font-semibold">{agent.name}</h3>
                          <p className="text-text-secondary text-xs">{agent.lastActive}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBg(agent.status)} ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-text-secondary text-xs mb-1">Reputation</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{agent.reputation}</span>
                          <div className="w-16 h-2 bg-bg-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-neon-green to-cyan-blue rounded-full"
                              style={{ width: `${agent.reputation}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-text-secondary text-xs mb-1">Tasks</p>
                        <p className="font-semibold">{agent.tasksCompleted.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-neon-green/10 text-neon-green rounded-lg hover:bg-neon-green/20 transition-colors text-sm font-medium">
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors text-sm font-medium">
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                      <button className="p-2 bg-bg-elevated rounded-lg hover:bg-border-subtle transition-colors">
                        <FileText className="w-4 h-4 text-text-secondary" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Reputation Graph */}
            <section className="bg-bg-card border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-blue" />
                    Reputation History
                  </h2>
                  <p className="text-text-secondary text-sm">Last 30 days performance</p>
                </div>
                <div className="flex items-center gap-4">
                  {milestones.slice(0, 3).map((m) => (
                    <div key={m.score} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-xs text-text-secondary">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-64">
                {renderReputationChart()}
              </div>
            </section>
          </div>

          {/* Right Column - Swarms & Disputes */}
          <div className="space-y-8">
            {/* Active Swarms */}
            <section className="bg-bg-card border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-electric-purple" />
                  Active Swarms
                </h2>
                <span className="text-xs text-text-secondary">{mockSwarms.length} running</span>
              </div>
              <div className="space-y-3">
                {mockSwarms.map((swarm) => (
                  <div
                    key={swarm.id}
                    className="p-4 bg-bg-elevated rounded-lg hover:bg-border-subtle/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-sm group-hover:text-cyan-blue transition-colors">
                          {swarm.name}
                        </h3>
                        <p className="text-text-muted text-xs">{swarm.region}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBg(swarm.status)} ${getStatusColor(swarm.status)}`}>
                        {swarm.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {swarm.agents} agents
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {swarm.throughput}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2 border border-border-subtle rounded-lg text-sm text-text-secondary hover:border-cyan-blue hover:text-cyan-blue transition-colors">
                Manage Swarms
              </button>
            </section>

            {/* Recent Disputes */}
            <section className="bg-bg-card border border-border-subtle rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  Recent Disputes
                </h2>
                <button className="text-xs text-cyan-blue hover:text-cyan-blue/80 transition-colors">
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-text-secondary border-b border-border-subtle">
                      <th className="pb-3 font-medium">ID</th>
                      <th className="pb-3 font-medium">Agent</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {mockDisputes.map((dispute) => (
                      <tr key={dispute.id} className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-elevated/50 transition-colors">
                        <td className="py-3 font-mono text-xs">{dispute.id}</td>
                        <td className="py-3">
                          <div>
                            <p className="font-medium">{dispute.agent}</p>
                            <p className="text-xs text-text-secondary">{dispute.type}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusBg(dispute.status)} ${getStatusColor(dispute.status)}`}>
                            {dispute.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-gradient-to-br from-neon-green/5 to-cyan-blue/5 border border-neon-green/20 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button className="w-full py-3 bg-bg-card border border-border-subtle rounded-lg text-sm font-medium hover:border-neon-green hover:text-neon-green transition-colors flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  Deploy New Agent
                </button>
                <button className="w-full py-3 bg-bg-card border border-border-subtle rounded-lg text-sm font-medium hover:border-cyan-blue hover:text-cyan-blue transition-colors flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  Create Swarm
                </button>
                <button className="w-full py-3 bg-bg-card border border-border-subtle rounded-lg text-sm font-medium hover:border-electric-purple hover:text-electric-purple transition-colors flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  File Attestation
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
