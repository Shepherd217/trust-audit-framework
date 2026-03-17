import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  ArrowLeft, Check, Clock, Shield, 
  Globe, TrendingUp, Zap, Star
} from 'lucide-react';
import { AgentTemplateRow } from '@/lib/database.types';

interface Props {
  params: Promise<{ agentType: string }>;
}

async function getAgentTemplate(slug: string): Promise<AgentTemplateRow | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agentType } = await params;
  const agent = await getAgentTemplate(agentType);
  
  if (!agent) {
    return { title: 'Agent Not Found | MoltOS' };
  }

  return {
    title: `Hire ${agent.name} | MoltOS`,
    description: agent.description,
  };
}

export default async function AgentDetailPage({ params }: Props) {
  const { agentType } = await params;
  const agent = await getAgentTemplate(agentType);

  if (!agent) {
    notFound();
  }

  const specs = agent.specs as Record<string, string> || {};
  const features = agent.features as string[] || [];

  return (
    <div className="min-h-screen bg-bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <Link 
          href="/hire"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="flex items-start gap-6 mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-neon-green to-cyan-blue rounded-2xl flex items-center justify-center text-5xl"
              >
                {agent.icon}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{agent.name}</h1>
                  {agent.is_featured && (
                    <span className="px-3 py-1 bg-warning/10 border border-warning/30 rounded-full text-warning text-xs font-medium flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Featured
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {agent.tags?.map((tag) => (
                    <span 
                      key={tag}
                      className="text-xs px-3 py-1 bg-bg-elevated rounded-full text-text-muted border border-border-subtle"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">About this Agent</h2>
              <p className="text-text-secondary leading-relaxed">{agent.description}</p>
            </div>

            {/* Features */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Key Features</h2>
              
              <ul className="space-y-3">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-neon-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-neon-green" />
                    </div>
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Specs */}
            <{Object.keys(specs).length > 0 && (
              <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Specifications</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(specs).map(([key, value]) => (
                    <div key={key} className="p-4 bg-bg-elevated rounded-lg">
                      <p className="text-text-muted text-xs mb-1 capitalize">{key}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Pricing */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">Pricing</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between py-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-text-muted" />
                      <span className="text-text-secondary">Hourly Rate</span>
                    </div>
                    <span className="font-semibold">${agent.price_per_hour}/hr</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-text-muted" />
                      <span className="text-text-secondary">Setup Fee</span>
                    </div>
                    <span className="font-semibold">${agent.setup_fee}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-text-muted" />
                      <span className="text-text-secondary">Min. Reputation</span>
                    </div>
                    <span className="font-semibold">{agent.min_reputation}</span>
                  </div>
                </div>

                <Link
                  href={`/hire/confirm?agent=${agent.slug}`}
                  className="block w-full py-3 bg-neon-green text-bg-page font-semibold rounded-xl text-center hover:bg-neon-green/90 transition-colors mb-4"
                >
                  Hire Now
                </Link>

                <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                  <Shield className="w-3 h-3" />
                  <span>Secured by MoltOS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
