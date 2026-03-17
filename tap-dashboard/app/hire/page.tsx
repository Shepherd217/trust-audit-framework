import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Search, Zap, Shield, TrendingUp, Sparkles } from 'lucide-react';
import { AgentTemplateRow } from '@/lib/database.types';

export const metadata: Metadata = {
  title: 'Hire an Agent | MoltOS',
  description: 'Browse and hire AI agents for your MoltOS fleet',
};

async function getAgentTemplates(): Promise<AgentTemplateRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching agent templates:', error);
    return [];
  }

  return data || [];
}

export default async function HirePage() {
  const agents = await getAgentTemplates();
  
  const featuredAgents = agents.filter(a => a.is_featured);
  const regularAgents = agents.filter(a => !a.is_featured);

  return (
    <div className="min-h-screen bg-bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/dashboard"
            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <div>
            <h1 className="text-2xl font-bold">Agent Marketplace</h1>
            <p className="text-text-secondary">Hire specialized AI agents for your fleet</p>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatBadge icon={Zap} label="Available" value={agents.length} />
          <StatBadge icon={Sparkles} label="Categories" value={new Set(agents.map(a => a.category)).size} />
          <StatBadge icon={TrendingUp} label="Featured" value={featuredAgents.length} />
          <StatBadge icon={Shield} label="Verified" value={agents.length} />
        </div>

        {/* Featured Section */}
        {featuredAgents.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-warning" />
              <h2 className="text-lg font-semibold">Featured Agents</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} featured />
              ))}
            </div>
          </section>
        )}

        {/* All Agents */}
        <section>
          <h2 className="text-lg font-semibold mb-6">All Agents</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatBadge({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: typeof Zap;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-neon-green/10 rounded-lg">
          <Icon className="w-4 h-4 text-neon-green" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-text-muted text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ 
  agent, 
  featured = false 
}: { 
  agent: AgentTemplateRow;
  featured?: boolean;
}) {
  const categoryColors: Record<string, string> = {
    core: 'bg-neon-green/10 text-neon-green',
    finance: 'bg-cyan-blue/10 text-cyan-blue',
    support: 'bg-electric-purple/10 text-electric-purple',
    analytics: 'bg-warning/10 text-warning',
    security: 'bg-error/10 text-error',
    marketing: 'bg-pink-500/10 text-pink-500',
  };

  return (
    <Link
      href={`/hire/${agent.slug}`}
      className={`block bg-bg-card border rounded-xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg ${
        featured 
          ? 'border-warning/30 ring-1 ring-warning/20' 
          : 'border-border-subtle hover:border-neon-green/50'
      }`}
    >
      {/* Header Gradient */}
      <div className={`h-24 ${
        featured 
          ? 'bg-gradient-to-r from-warning/20 via-orange-500/20 to-yellow-500/20' 
          : 'bg-gradient-to-r from-neon-green/10 via-cyan-blue/10 to-electric-purple/10'
      }`} />
      
      <div className="p-5 -mt-8">
        {/* Icon */}
        <div className="w-16 h-16 bg-bg-card border-4 border-bg-page rounded-2xl flex items-center justify-center text-3xl mb-4">
          {agent.icon}
        </div>
        
        {/* Info */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold text-lg">{agent.name}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${categoryColors[agent.category] || 'bg-text-muted/10 text-text-muted'}`}>
              {agent.category}
            </span>
          </div>
          
          <p className="text-text-secondary text-sm line-clamp-2">
            {agent.short_description || agent.description}
          </p>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {agent.tags?.slice(0, 3).map((tag) => (
            <span 
              key={tag}
              className="text-xs px-2 py-1 bg-bg-elevated rounded-full text-text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
        
        {/* Price & Action */}
        <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
          <div>
            <p className="text-xs text-text-muted">Starting at</p>
            <p className="font-semibold">
              ${agent.price_per_hour}
              <span className="text-text-muted text-sm font-normal">/hr</span>
            </p>
          </div>
          
          <span className="text-sm text-neon-green font-medium">
            View Details →
          </span>
        </div>
      </div>
    </Link>
  );
}
