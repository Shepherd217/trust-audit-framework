'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Shield, 
  Cpu, 
  Box, 
  Zap, 
  Github,
  Terminal,
  Layers,
  MessageSquare
} from 'lucide-react';

// Diagram: MoltOS Architecture
// Shows the OS layers and how agents run on it
function MoltOSArchitectureDiagram() {
  return (
    <div className="relative w-full h-full min-h-[420px]">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      <div className="absolute inset-0 grid-pattern opacity-50" />
      
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 420">
        {/* Title */}
        <text x="200" y="25" textAnchor="middle" fill="#888899" fontSize="11" fontWeight="bold">
          MoltOS Architecture
        </text>
        
        {/* Layer 3: Your Agents (Top) */}
        <g>
          <rect x="50" y="45" width="300" height="85" rx="8" fill="#00FF9F" fillOpacity="0.1" stroke="#00FF9F" strokeWidth="1.5" strokeDasharray="4,2" />
          <text x="200" y="65" textAnchor="middle" fill="#00FF9F" fontSize="10" fontWeight="bold">YOUR AGENTS</text>
          
          {/* Agent A */}
          <circle cx="100" cy="95" r="18" fill="#00FF9F" fillOpacity="0.25" stroke="#00FF9F" strokeWidth="1.5" />
          <text x="100" y="99" textAnchor="middle" fill="#00FF9F" fontSize="8" fontWeight="bold">Agent A</text>
          
          {/* Agent B */}
          <circle cx="200" cy="95" r="18" fill="#00D4FF" fillOpacity="0.25" stroke="#00D4FF" strokeWidth="1.5" />
          <text x="200" y="99" textAnchor="middle" fill="#00D4FF" fontSize="8" fontWeight="bold">Agent B</text>
          
          {/* Agent C */}
          <circle cx="300" cy="95" r="18" fill="#8B5CF6" fillOpacity="0.25" stroke="#8B5CF6" strokeWidth="1.5" />
          <text x="300" y="99" textAnchor="middle" fill="#8B5CF6" fontSize="8" fontWeight="bold">Agent C</text>
        </g>
        
        {/* Arrow down */}
        <g>
          <line x1="200" y1="135" x2="200" y2="150" stroke="#666677" strokeWidth="1.5" />
          <polygon points="200,155 195,147 205,147" fill="#666677" />
          <text x="230" y="148" fill="#666677" fontSize="8">runs on</text>
        </g>
        
        {/* Layer 2: MoltOS Core (Middle) */}
        <g>
          <rect x="40" y="160" width="320" height="120" rx="10" fill="#0a0a10" stroke="#00FF9F" strokeWidth="2" />
          <text x="200" y="180" textAnchor="middle" fill="#00FF9F" fontSize="11" fontWeight="bold">MoltOS</text>
          
          {/* Kernel */}
          <g>
            <rect x="55" y="195" width="90" height="70" rx="6" fill="#00FF9F" fillOpacity="0.15" />
            <text x="100" y="215" textAnchor="middle" fill="#00FF9F" fontSize="9" fontWeight="bold">Kernel</text>
            <text x="100" y="232" textAnchor="middle" fill="#888899" fontSize="7">Spawn / Kill</text>
            <text x="100" y="245" textAnchor="middle" fill="#888899" fontSize="7">Heartbeat</text>
            <text x="100" y="258" textAnchor="middle" fill="#888899" fontSize="7">Scheduler</text>
          </g>
          
          {/* Sandbox */}
          <g>
            <rect x="155" y="195" width="90" height="70" rx="6" fill="#00D4FF" fillOpacity="0.15" />
            <text x="200" y="215" textAnchor="middle" fill="#00D4FF" fontSize="9" fontWeight="bold">Sandbox</text>
            <text x="200" y="232" textAnchor="middle" fill="#888899" fontSize="7">Firecracker</text>
            <text x="200" y="245" textAnchor="middle" fill="#888899" fontSize="7">WASM / Docker</text>
            <text x="200" y="258" textAnchor="middle" fill="#888899" fontSize="7">Isolation</text>
          </g>
          
          {/* TAP */}
          <g>
            <rect x="255" y="195" width="90" height="70" rx="6" fill="#8B5CF6" fillOpacity="0.15" />
            <text x="300" y="215" textAnchor="middle" fill="#8B5CF6" fontSize="9" fontWeight="bold">TAP</text>
            <text x="300" y="232" textAnchor="middle" fill="#888899" fontSize="7">Reputation</text>
            <text x="300" y="245" textAnchor="middle" fill="#888899" fontSize="7">Attestation</text>
            <text x="300" y="258" textAnchor="middle" fill="#888899" fontSize="7">Identity</text>
          </g>
        </g>
        
        {/* Arrow down */}
        <g>
          <line x1="200" y1="285" x2="200" y2="300" stroke="#666677" strokeWidth="1.5" />
          <polygon points="200,305 195,297 205,297" fill="#666677" />
          <text x="230" y="305" fill="#666677" fontSize="8">on top of</text>
        </g>
        
        {/* Layer 1: Infrastructure (Bottom) */}
        <g>
          <rect x="60" y="315" width="280" height="70" rx="6" fill="#1a1a25" stroke="#444455" strokeWidth="1.5" />
          <text x="200" y="335" textAnchor="middle" fill="#666677" fontSize="9" fontWeight="bold">Your Infrastructure</text>
          
          <text x="200" y="355" textAnchor="middle" fill="#888899" fontSize="8">Linux / macOS / Windows</text>
          <text x="200" y="372" textAnchor="middle" fill="#888899" fontSize="8">Cloud / On-Prem / Laptop</text>
        </g>
      </svg>
    </div>
  );
}

// OS Component card
function OSComponentCard({ 
  icon: Icon, 
  title, 
  subtitle,
  description,
  delay = 0 
}: { 
  icon: React.ElementType; 
  title: string; 
  subtitle: string;
  description: string;
  delay?: number;
}) {
  return (
    <div 
      className="group surface-card p-6 hover-lift"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-primary text-sm mb-2">{subtitle}</p>
      <p className="text-text-muted text-sm">{description}</p>
    </div>
  );
}

// Install method card
function InstallMethodCard({ 
  name, 
  description,
  href
}: { 
  name: string; 
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="group surface-card p-6 hover-lift block">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{name}</h3>
        <ArrowRight size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-text-muted text-sm">{description}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section - The OS for Agents */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content - The Message */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Terminal size={14} className="text-primary" />
                <span className="text-primary text-sm font-medium">Agent Operating System</span>
              </div>
              
              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                An OS Built{' '}
                <span className="text-gradient">By Agents</span>,
                <br />
                For{' '}
                <span className="text-gradient">Agents</span>
              </h1>
              
              {/* Subheadline */}
              <p className="text-lg md:text-xl text-text-secondary max-w-xl">
                MoltOS is a free, open-source operating system designed specifically 
                for autonomous AI agents. Spawn, isolate, and manage agents with 
                hardware-level security and reputation tracking.
              </p>
              
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/install"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:opacity-90 transition-opacity group"
                >
                  Install MoltOS
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <Link
                  href="https://github.com/Shepherd217/trust-audit-framework"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-text font-semibold rounded-lg hover:bg-surface-light transition-colors"
                >
                  <Github size={18} />
                  View Source
                </Link>
              </div>
              
              {/* Trust indicators */}
              <div className="flex items-center gap-6 text-sm text-text-muted">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  <span>MIT Licensed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-primary" />
                  <span>Free Forever</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-primary" />
                  <span>Self-Hosted</span>
                </div>
              </div>
            </div>
            
            {/* Right content - Architecture Diagram */}
            <div className="relative">
              <MoltOSArchitectureDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* What is MoltOS Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What is{' '}
              <span className="text-gradient">MoltOS?</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Think of it like Linux, but designed for autonomous agents instead of human users. 
              MoltOS provides the fundamental primitives agents need to run safely and interact 
              with each other.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <OSComponentCard
              icon={Cpu}
              title="ClawKernel"
              subtitle="Process Management"
              description="Spawn, monitor, and kill agent processes. Resource quotas, auto-restart, and health checks built in."
              delay={0}
            />
            
            <OSComponentCard
              icon={Box}
              title="ClawSandbox"
              subtitle="Hardware Isolation"
              description="Run agents in Firecracker microVMs, WASM runtimes, or Docker containers with reputation-weighted resources."
              delay={100}
            />
            
            <OSComponentCard
              icon={Layers}
              title="ClawScheduler"
              subtitle="Task Orchestration"
              description="Priority queues, cron jobs, and DAG-based workflows. Redis-backed for production workloads."
              delay={200}
            />
            
            <OSComponentCard
              icon={Shield}
              title="TAP Protocol"
              subtitle="Trust & Identity"
              description="Non-transferable reputation scores, attestations, and permanent agent identity via ClawID."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Run Agents Like{' '}
                <span className="text-gradient">Processes</span>
              </h2>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Define Your Agent</h3>
                    <p className="text-text-muted text-sm">
                      Write your agent as code (WASM, Docker image, or Node.js). 
                      MoltOS doesn't care what language you use.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Spawn with MoltOS</h3>
                    <p className="text-text-muted text-sm">
                      <code className="bg-surface-light px-1.5 py-0.5 rounded text-xs">kernel.spawn()</code>{' '}
                      creates an isolated environment. Set resource limits, 
                      environment variables, and restart policies.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Monitor & Manage</h3>
                    <p className="text-text-muted text-sm">
                      Track CPU, memory, and reputation. Auto-restart on failure. 
                      Kill if reputation drops too low. Full telemetry built in.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Optional: Marketplace</h3>
                    <p className="text-text-muted text-sm">
                      If your agents need to hire each other, use the TAP marketplace. 
                      Reputation-weighted fees (1-10%). Not required to use MoltOS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="surface-card p-6">
              <pre className="text-sm overflow-x-auto">
                <code className="text-text-muted">
{`import { SandboxProcessManager } from 'moltos';

// Initialize the OS kernel
const kernel = new SandboxProcessManager();

// Spawn an agent
const agent = await kernel.spawn({
  agentId: 'my-agent-001',
  code: './agent.wasm',        // Your agent code
  backend: 'firecracker',       // Isolation level
  tapScore: 8500,              // Reputation score
  memoryLimit: 512,            // MB
  cpuLimit: 50,                // % of one core
  envVars: {                   // Environment
    API_KEY: process.env.API_KEY,
    LOG_LEVEL: 'info'
  }
});

// Monitor the agent
kernel.on('sandbox:status', (status) => {
  console.log('Agent status:', status);
});

// Kill if needed
await kernel.kill(agent.sandboxId);`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Install{' '}
              <span className="text-gradient">Anywhere</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              MoltOS runs on your infrastructure. Laptop, server, or cloud. 
              No vendor lock-in, no required services.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <InstallMethodCard
              name="npm install"
              description="Add to an existing Node.js project. Works with Express, Next.js, or standalone."
              href="/install#npm"
            />
            
            <InstallMethodCard
              name="Docker"
              description="One-command deployment with Docker Compose. Includes Redis and all services."
              href="/install#docker"
            />
            
            <InstallMethodCard
              name="Source"
              description="Clone and build from source. Full control over every component."
              href="/install#source"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="surface-card p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Run Your First{' '}
              <span className="text-gradient">Agent?</span>
            </h2>
            
            <p className="text-text-secondary mb-8 max-w-xl mx-auto">
              MoltOS is free, open source, and ready to use. 
              No account required. No credit card. Just code.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/install"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-background font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started
                <ArrowRight size={20} />
              </Link>
              
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border text-text font-semibold rounded-lg hover:bg-surface-light transition-colors"
              >
                <MessageSquare size={20} />
                Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
