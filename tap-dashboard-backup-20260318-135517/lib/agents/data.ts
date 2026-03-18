/**
 * Agent Marketplace Types and Data
 * MoltOS Agent Marketplace - Real Pricing Structure
 */

export type AgentId = 'genesis' | 'support' | 'monitor' | 'trading';
export type TierLevel = 'starter' | 'builder' | 'pro' | 'enterprise';

export interface AgentTierInfo {
  tier: TierLevel;
  included: boolean;
  monthlyPrice: number;
}

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  longDescription: string;
  icon: string;
  color: string;
  features: string[];
  pricing: {
    monthly: number;
    includedIn: TierLevel[];
  };
  tierRequirements: Record<TierLevel, AgentTierInfo>;
  capabilities: string[];
  useCases: string[];
  demoAvailable: boolean;
}

export interface PricingTier {
  id: TierLevel;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  includedAgents: AgentId[];
  agentLimit: number | 'unlimited';
  highlighted?: boolean;
}

// ============================================================================
// AGENT DEFINITIONS WITH REAL PRICING
// ============================================================================

export const AGENTS: Record<AgentId, Agent> = {
  genesis: {
    id: 'genesis',
    name: 'Genesis Agent',
    description: 'Your first autonomous AI assistant - perfect for getting started',
    longDescription: 'Genesis is the foundational agent that introduces you to the MoltOS ecosystem. It handles basic tasks, answers questions, and helps you navigate the platform. Perfect for individuals and small teams just getting started with AI agents.',
    icon: '🌱',
    color: '#00FF9F',
    features: [
      'Basic task automation',
      'Natural language understanding',
      'Email and messaging integration',
      'Calendar management',
      'Simple research capabilities',
      'Web search and browsing',
      'File organization',
      'Up to 100 tasks/month',
    ],
    pricing: {
      monthly: 0,
      includedIn: ['starter', 'builder', 'pro', 'enterprise'],
    },
    tierRequirements: {
      starter: { tier: 'starter', included: true, monthlyPrice: 0 },
      builder: { tier: 'builder', included: true, monthlyPrice: 0 },
      pro: { tier: 'pro', included: true, monthlyPrice: 0 },
      enterprise: { tier: 'enterprise', included: true, monthlyPrice: 0 },
    },
    capabilities: ['text-generation', 'web-search', 'scheduling', 'file-ops'],
    useCases: [
      'Personal productivity assistant',
      'Email drafting and management',
      'Meeting scheduling',
      'Basic research tasks',
      'Note-taking and organization',
    ],
    demoAvailable: true,
  },
  support: {
    id: 'support',
    name: 'Support Agent',
    description: '24/7 customer support automation with human handoff',
    longDescription: 'Support Agent provides intelligent, automated customer service that understands context, resolves common issues, and seamlessly escalates to human agents when needed. Reduce response times and improve customer satisfaction.',
    icon: '🎧',
    color: '#3B82F6',
    features: [
      'Multi-channel support (email, chat, voice)',
      'Ticket management and routing',
      'Knowledge base integration',
      'Sentiment analysis',
      'Automatic escalation to humans',
      'Response templates and macros',
      'Customer history tracking',
      ' SLA monitoring and alerts',
    ],
    pricing: {
      monthly: 10,
      includedIn: ['builder', 'pro', 'enterprise'],
    },
    tierRequirements: {
      starter: { tier: 'starter', included: false, monthlyPrice: 10 },
      builder: { tier: 'builder', included: true, monthlyPrice: 0 },
      pro: { tier: 'pro', included: true, monthlyPrice: 0 },
      enterprise: { tier: 'enterprise', included: true, monthlyPrice: 0 },
    },
    capabilities: ['sentiment-analysis', 'ticket-management', 'multi-channel', 'escalation'],
    useCases: [
      'Customer service automation',
      'Technical support triage',
      'FAQ and knowledge base answers',
      'Order status inquiries',
      'Complaint resolution',
    ],
    demoAvailable: true,
  },
  monitor: {
    id: 'monitor',
    name: 'Monitor Agent',
    description: 'Continuous system monitoring and intelligent alerting',
    longDescription: 'Monitor Agent keeps watch over your infrastructure, applications, and business metrics. It detects anomalies, predicts issues before they occur, and takes autonomous action to keep your systems healthy.',
    icon: '👁️',
    color: '#F59E0B',
    features: [
      'Real-time infrastructure monitoring',
      'Application performance tracking',
      'Anomaly detection with AI',
      'Predictive alerting',
      'Auto-remediation for common issues',
      'Custom dashboard generation',
      'Integration with PagerDuty, Slack, etc.',
      'Historical trend analysis',
    ],
    pricing: {
      monthly: 8,
      includedIn: ['builder', 'pro', 'enterprise'],
    },
    tierRequirements: {
      starter: { tier: 'starter', included: false, monthlyPrice: 8 },
      builder: { tier: 'builder', included: true, monthlyPrice: 0 },
      pro: { tier: 'pro', included: true, monthlyPrice: 0 },
      enterprise: { tier: 'enterprise', included: true, monthlyPrice: 0 },
    },
    capabilities: ['monitoring', 'alerting', 'anomaly-detection', 'auto-remediation'],
    useCases: [
      'Server and infrastructure monitoring',
      'Application uptime tracking',
      'Business metrics alerting',
      'Security incident detection',
      'Performance optimization recommendations',
    ],
    demoAvailable: true,
  },
  trading: {
    id: 'trading',
    name: 'Trading Agent',
    description: 'AI-powered market analysis and automated trading strategies',
    longDescription: 'Trading Agent analyzes market data, identifies opportunities, and executes trades based on your predefined strategies. It combines technical analysis, sentiment tracking, and risk management for intelligent trading automation.',
    icon: '📈',
    color: '#8B5CF6',
    features: [
      'Multi-exchange integration',
      'Technical analysis automation',
      'Sentiment analysis from news/social',
      'Risk management and position sizing',
      'Backtesting capabilities',
      'Portfolio rebalancing',
      'Arbitrage detection',
      'Paper trading mode',
    ],
    pricing: {
      monthly: 15,
      includedIn: ['pro', 'enterprise'],
    },
    tierRequirements: {
      starter: { tier: 'starter', included: false, monthlyPrice: 15 },
      builder: { tier: 'builder', included: false, monthlyPrice: 15 },
      pro: { tier: 'pro', included: true, monthlyPrice: 0 },
      enterprise: { tier: 'enterprise', included: true, monthlyPrice: 0 },
    },
    capabilities: ['market-analysis', 'trade-execution', 'risk-management', 'portfolio-management'],
    useCases: [
      'Cryptocurrency trading automation',
      'Stock market analysis',
      'Portfolio optimization',
      'Risk-adjusted position sizing',
      'Market sentiment tracking',
    ],
    demoAvailable: false,
  },
};

// ============================================================================
// PRICING TIER DEFINITIONS
// ============================================================================

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Perfect for individuals exploring AI agents',
    features: [
      'Genesis Agent (FREE)',
      '100 tasks/month',
      '1GB storage',
      'Community support',
      'Basic analytics',
      'Web interface access',
    ],
    includedAgents: ['genesis'],
    agentLimit: 1,
  },
  {
    id: 'builder',
    name: 'Builder',
    monthlyPrice: 29,
    annualPrice: 290,
    description: 'For creators building with AI agents',
    features: [
      'Genesis Agent',
      'Support Agent ($10 value)',
      'Monitor Agent ($8 value)',
      '5,000 tasks/month',
      '10GB storage',
      'Email support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
    ],
    includedAgents: ['genesis', 'support', 'monitor'],
    agentLimit: 3,
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 79,
    annualPrice: 790,
    description: 'For professionals and growing teams',
    features: [
      'Everything in Builder',
      'Trading Agent ($15 value)',
      'All 10 MoltOS primitives',
      '25,000 tasks/month',
      '100GB storage',
      'Priority support',
      'Advanced security features',
      'Team collaboration',
      'Custom agent training',
    ],
    includedAgents: ['genesis', 'support', 'monitor', 'trading'],
    agentLimit: 10,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    annualPrice: 1990,
    description: 'For organizations at scale',
    features: [
      'Everything in Pro',
      'Unlimited agents',
      'Unlimited tasks',
      'Unlimited storage',
      'Dedicated support',
      'SLA guarantees',
      'Custom contracts',
      'On-premise deployment option',
      'Advanced audit logs',
      'SSO and advanced security',
    ],
    includedAgents: ['genesis', 'support', 'monitor', 'trading'],
    agentLimit: 'unlimited',
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getAgentById(id: AgentId): Agent | undefined {
  return AGENTS[id];
}

export function getAllAgents(): Agent[] {
  return Object.values(AGENTS);
}

export function getTierById(id: TierLevel): PricingTier | undefined {
  return PRICING_TIERS.find(t => t.id === id);
}

export function getAgentsForTier(tierId: TierLevel): Agent[] {
  const tier = getTierById(tierId);
  if (!tier) return [];
  return tier.includedAgents.map(id => AGENTS[id]).filter(Boolean);
}

export function isAgentIncludedInTier(agentId: AgentId, tierId: TierLevel): boolean {
  const agent = AGENTS[agentId];
  if (!agent) return false;
  return agent.tierRequirements[tierId]?.included ?? false;
}

export function getAgentPriceForTier(agentId: AgentId, tierId: TierLevel): number {
  const agent = AGENTS[agentId];
  if (!agent) return 0;
  return agent.tierRequirements[tierId]?.monthlyPrice ?? agent.pricing.monthly;
}

export function formatPrice(price: number): string {
  if (price === 0) return 'FREE';
  return `$${price}/mo`;
}

export function calculateSavings(tier: PricingTier): number {
  const includedAgentsValue = tier.includedAgents.reduce((total, agentId) => {
    return total + AGENTS[agentId].pricing.monthly;
  }, 0);
  return includedAgentsValue;
}
