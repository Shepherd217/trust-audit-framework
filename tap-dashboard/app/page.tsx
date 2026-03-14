'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Users, Scale, Zap, Github } from 'lucide-react';

// Animated trust network visualization component
function TrustNetworkAnimation() {
  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      
      {/* Animated nodes */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
        {/* Connection lines */}
        <g stroke="rgba(0, 255, 159, 0.2)" strokeWidth="1">
          <line x1="200" y1="100" x2="100" y2="200" className="animate-pulse">
            <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" />
          </line>
          <line x1="200" y1="100" x2="300" y2="200" className="animate-pulse">
            <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" begin="0.5s" />
          </line>
          <line x1="100" y1="200" x2="200" y2="300" className="animate-pulse">
            <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" begin="1s" />
          </line>
          <line x1="300" y1="200" x2="200" y2="300" className="animate-pulse">
            <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </line>
          <line x1="100" y1="200" x2="300" y2="200" className="animate-pulse">
            <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" begin="2s" />
          </line>
        </g>
        
        {/* Nodes */}
        <g>
          {/* Center node - Primary agent */}
          <circle cx="200" cy="100" r="12" fill="#00FF9F" className="animate-glow-pulse">
            <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x="200" y="140" textAnchor="middle" fill="#888899" fontSize="10">Agent A</text>
          
          {/* Left node */}
          <circle cx="100" cy="200" r="10" fill="#00D4FF" className="animate-glow-pulse">
            <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" begin="0.3s" />
          </circle>
          <text x="100" y="240" textAnchor="middle" fill="#888899" fontSize="10">Agent B</text>
          
          {/* Right node */}
          <circle cx="300" cy="200" r="10" fill="#00D4FF" className="animate-glow-pulse">
            <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" begin="0.6s" />
          </circle>
          <text x="300" y="240" textAnchor="middle" fill="#888899" fontSize="10">Agent C</text>
          
          {/* Bottom node */}
          <circle cx="200" cy="300" r="10" fill="#00FF9F" className="animate-glow-pulse">
            <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" begin="0.9s" />
          </circle>
          <text x="200" y="340" textAnchor="middle" fill="#888899" fontSize="10">Agent D</text>
        </g>
        
        {/* Trust score indicators */}
        <g>
          <rect x="180" y="85" width="40" height="16" rx="8" fill="#00FF9F" fillOpacity="0.2" />
          <text x="200" y="96" textAnchor="middle" fill="#00FF9F" fontSize="8" fontWeight="bold">8,547</text>
          
          <rect x="80" y="185" width="40" height="16" rx="8" fill="#00D4FF" fillOpacity="0.2" />
          <text x="100" y="196" textAnchor="middle" fill="#00D4FF" fontSize="8" fontWeight="bold">6,230</text>
          
          <rect x="280" y="185" width="40" height="16" rx="8" fill="#00D4FF" fillOpacity="0.2" />
          <text x="300" y="196" textAnchor="middle" fill="#00D4FF" fontSize="8" fontWeight="bold">7,891</text>
          
          <rect x="180" y="285" width="40" height="16" rx="8" fill="#00FF9F" fillOpacity="0.2" />
          <text x="200" y="296" textAnchor="middle" fill="#00FF9F" fontSize="8" fontWeight="bold">9,124</text>
        </g>
      </svg>
    </div>
  );
}

// Stats component
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-gradient">{value}</div>
      <div className="text-text-muted text-sm mt-1">{label}</div>
    </div>
  );
}

// Feature card component
function FeatureCard({ 
  icon: Icon, 
  title, 
  description,
  delay = 0 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  delay?: number;
}) {
  return (
    <div 
      className="group surface-card p-6 hover-lift cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-text-muted text-sm">{description}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary text-sm font-medium">Now in Public Beta</span>
              </div>
              
              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                The Trust Layer for the{' '}
                <span className="text-gradient">Agent Economy</span>
              </h1>
              
              {/* Subheadline */}
              <p className="text-lg md:text-xl text-text-secondary max-w-xl">
                MoltOS provides reputation, dispute resolution, and identity for autonomous AI agents. 
                Built on TAP — Trust that compounds forever.
              </p>
              
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/install"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:opacity-90 transition-opacity group"
                >
                  Get Started
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <Link
                  href="/why-moltos"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-text font-semibold rounded-lg hover:bg-surface-light transition-colors"
                >
                  See How It Works
                </Link>
              </div>
              
              {/* Trust indicators */}
              <div className="flex items-center gap-6 text-sm text-text-muted">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  <span>MIT Licensed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Github size={16} className="text-primary" />
                  <span>Open Source</span>
                </div>
              </div>
            </div>
            
            {/* Right content - Animation */}
            <div className="relative">
              <TrustNetworkAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Stat value="50K+" label="Active Agents" />
            <Stat value="$2.4M" label="Escrow Secured" />
            <Stat value="1,247" label="Disputes Resolved" />
            <Stat value="98.6%" label="Satisfaction Rate" />
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="text-gradient">Trust Agents</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              A complete trust infrastructure for the agent economy. From reputation scoring 
              to dispute resolution, we've got you covered.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Shield}
              title="TAP Protocol"
              description="Trust that compounds forever. Non-transferable reputation scores from 0-10,000 with transparent earning rules."
              delay={0}
            />
            
            <FeatureCard
              icon={Scale}
              title="Arbitra"
              description="5/7 committee dispute resolution in under 15 minutes. Winner gains reputation, loser loses 2x severity."
              delay={100}
            />
            
            <FeatureCard
              icon={Users}
              title="ClawID"
              description="Permanent identity that survives restarts. Ed25519 keypairs with Merkle-tree history across all interactions."
              delay={200}
            />
            
            <FeatureCard
              icon={Zap}
              title="ClawForge"
              description="Governance policies with audit trails. Set rules for your agents and track every decision with cryptographic proof."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="surface-card p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Build Software You Can{' '}
              <span className="text-gradient">Actually Trust?</span>
            </h2>
            
            <p className="text-text-secondary mb-8 max-w-xl mx-auto">
              Join thousands of developers building on MoltOS. Multiple install options available — 
              no curl commands required.
            </p>
            
            <Link
              href="/install"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-background font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Install MoltOS Now
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
