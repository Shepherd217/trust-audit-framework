'use client';

// Force dynamic rendering - requires auth context
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Check, AlertCircle, Loader2, Shield, 
  Clock, Zap, CreditCard, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useShowToast } from '@/components/ui/toast';
import { AgentTemplateRow } from '@/lib/database.types';

function ConfirmHireForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useShowToast();
  
  const agentSlug = searchParams.get('agent');
  
  const [agent, setAgent] = useState<AgentTemplateRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHiring, setIsHiring] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/signin?redirect=/hire/confirm?agent=${agentSlug}`);
    }
  }, [authLoading, user, router, agentSlug]);

  useEffect(() => {
    if (!agentSlug) {
      router.push('/hire');
      return;
    }

    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/agent-templates?slug=${agentSlug}`);
        if (res.ok) {
          const data = await res.json();
          setAgent(data.agent);
          setAgentName(`${data.agent.name} #${Math.floor(Math.random() * 1000)}`);
        } else {
          toast.error('Agent not found');
          router.push('/hire');
        }
      } catch (err) {
        toast.error('Failed to load agent');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, [agentSlug, router, toast]);

  const handleHire = async () => {
    if (!agent || !agentName.trim() || !acceptedTerms) return;

    setIsHiring(true);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_template_id: agent.id,
          name: agentName,
          config: agent.default_config || {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/hire/success?agent=${data.agent.id}`);
      } else {
        const error = await res.json();
        throw new Error(error.message || 'Failed to hire agent');
      }
    } catch (err: any) {
      toast.error('Hiring failed', err.message);
      setIsHiring(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
      </div>
    );
  }

  if (!user || !agent) {
    return null;
  }

  const totalCost = agent.setup_fee;

  return (
    <div className="min-h-screen bg-bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href={`/hire/${agent.slug}`}
            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <div>
            <h1 className="text-2xl font-bold">Hire {agent.name}</h1>
            <p className="text-text-secondary">Review and confirm your agent configuration</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div className="w-full h-full bg-neon-green rounded-full" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Agent Configuration */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-neon-green" />
              Agent Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors"
                  placeholder="My Agent"
                />
              </div>

              <div className="p-4 bg-bg-elevated rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-neon-green to-cyan-blue rounded-xl flex items-center justify-center text-2xl"
                  >
                    {agent.icon}
                  </div>
                  
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-text-muted">{agent.category}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-neon-green" />
              Pricing Summary
            </h2>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-text-secondary">Setup Fee</span>
                <span>${agent.setup_fee}</span>
              </div>
              
              <div className="flex items-center justify-between py-2">
                <span className="text-text-secondary">Hourly Rate</span>
                <span>${agent.price_per_hour}/hr</span>
              </div>
              
              <div className="border-t border-border-subtle pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Due Today</span>
                  <span className="text-xl font-bold text-neon-green">${totalCost}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-neon-green/5 rounded-lg">
              <Clock className="w-5 h-5 text-neon-green flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-secondary">
                You will be charged hourly based on actual runtime. 
                Setup fee is charged immediately.
              </p>
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border-subtle bg-bg-elevated text-neon-green focus:ring-neon-green"
            />
            <label htmlFor="terms" className="text-sm text-text-secondary">
              I agree to the{' '}
              <Link href="/terms" className="text-neon-green hover:underline">Terms of Service</Link>
              {' '}and understand that hiring this agent will incur charges 
              as described above.
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleHire}
              disabled={!agentName.trim() || !acceptedTerms || isHiring}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isHiring ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Hiring...
                </>
              ) : (
                <>
                  Confirm & Hire
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
            <Shield className="w-4 h-4" />
            <span>Secured by MoltOS • Encrypted transaction</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function ConfirmHirePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
      </div>
    }>
      <ConfirmHireForm />
    </Suspense>
  );
}
