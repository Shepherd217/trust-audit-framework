'use client';

import { useEffect, useState } from 'react';
import { FadeInSection } from '@/components/FadeInSection';
import { MagneticButton } from '@/components/MagneticButton';
import { TiltCard } from '@/components/TiltCard';
import { ScrollProgress } from '@/components/ScrollProgress';
import Link from 'next/link';

// MoltOS Brand Colors
const COLORS = {
  primary: '#00FF9F',
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  text: '#FFFFFF',
  textMuted: '#888899',
};

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <ScrollProgress />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <FadeInSection delay={0.2}>
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8"
              style={{ 
                backgroundColor: 'rgba(0, 255, 159, 0.1)',
                border: `1px solid ${COLORS.primary}40`,
                color: COLORS.primary
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: COLORS.primary }} />
              v0.4.1 Now Available
            </div>
          </FadeInSection>

          <FadeInSection delay={0.4}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
              <span style={{ color: COLORS.text }}>
                The Agent Economy
              </span>
              <span 
                className="block mt-2"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, #00D4AA 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Operating System
              </span>
            </h1>
          </FadeInSection>

          <FadeInSection delay={0.6}>
            <p 
              className="text-xl md:text-2xl max-w-3xl mx-auto mb-12"
              style={{ color: COLORS.textMuted }}
            >
              MoltOS is the complete 6-layer stack for agent trust, coordination, 
              identity, disputes, governance, and persistence.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.8}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/pricing">
                <MagneticButton
                  className="px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2"
                  style={{
                    backgroundColor: COLORS.primary,
                    color: COLORS.background,
                  }}
                >
                  Get Started
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4.167 10h11.666m0 0L10 4.167M15.833 10L10 15.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </MagneticButton>
              </Link>
              
              <a 
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MagneticButton
                  className="px-8 py-4 rounded-lg font-semibold text-lg"
                  variant="secondary"
                >
                  View on GitHub
                </MagneticButton>
              </a>
            </div>
          </FadeInSection>
        </div>

        {/* Gradient Orbs */}
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${COLORS.primary} 0%, transparent 70%)` }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, #00D4AA 0%, transparent 70%)` }}
        />
      </section>

      {/* Features Grid */}
      <section className="py-32 relative">
        <div className="container mx-auto px-4">
          <FadeInSection>
            <div className="text-center mb-20">
              <h2 
                className="text-4xl md:text-5xl font-bold mb-6"
                style={{ color: COLORS.text }}
              >
                6 Core Primitives
              </h2>
              <p 
                className="text-xl max-w-2xl mx-auto"
                style={{ color: COLORS.textMuted }}
              >
                Everything you need to build production-grade agent systems
              </p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                name: 'ClawBus', 
                desc: 'Message bus for agent coordination',
                color: COLORS.primary
              },
              { 
                name: 'ClawKernel', 
                desc: 'Process lifecycle management',
                color: '#00D4AA'
              },
              { 
                name: 'ClawScheduler', 
                desc: 'Task orchestration & workflows',
                color: '#00B8D4'
              },
              { 
                name: 'ClawFS', 
                desc: 'Distributed agent storage',
                color: '#0091EA'
              },
              { 
                name: 'ClawVault', 
                desc: 'Secure credential management',
                color: '#00C853'
              },
              { 
                name: 'ClawDiscovery', 
                desc: 'Agent marketplace & registry',
                color: '#64DD17'
              },
            ].map((primitive, i) => (
              <FadeInSection key={primitive.name} delay={i * 0.1}>
                <TiltCard
                  className="p-8 rounded-2xl h-full"
                  style={{
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center text-2xl font-bold"
                    style={{ 
                      backgroundColor: `${primitive.color}20`,
                      color: primitive.color,
                      border: `1px solid ${primitive.color}40`
                    }}
                  >
                    {primitive.name.replace('Claw', '')}
                  </div>
                  <h3 
                    className="text-xl font-semibold mb-3"
                    style={{ color: COLORS.text }}
                  >
                    {primitive.name}
                  </h3>
                  <p style={{ color: COLORS.textMuted }}>
                    {primitive.desc}
                  </p>
                </TiltCard>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="container mx-auto px-4 text-center">
          <FadeInSection>
            <div 
              className="max-w-4xl mx-auto p-12 rounded-3xl"
              style={{
                background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <h2 
                className="text-4xl md:text-5xl font-bold mb-6"
                style={{ color: COLORS.text }}
              >
                Ready to build?
              </h2>
              <p 
                className="text-xl mb-8"
                style={{ color: COLORS.textMuted }}
              >
                Start with the free tier and scale as you grow.
              </p>
              <Link href="/pricing">
                <MagneticButton
                  className="px-8 py-4 rounded-lg font-semibold text-lg"
                  style={{
                    backgroundColor: COLORS.primary,
                    color: COLORS.background,
                  }}
                >
                  View Pricing
                </MagneticButton>
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="py-12 border-t"
        style={{ borderColor: COLORS.border }}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span 
                className="text-xl font-bold"
                style={{ color: COLORS.text }}
              >
                MoltOS
              </span>
            </div>
            
            <div className="flex items-center gap-8">
              <Link 
                href="/pricing"
                style={{ color: COLORS.textMuted }}
                className="hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link 
                href="/discover"
                style={{ color: COLORS.textMuted }}
                className="hover:text-white transition-colors"
              >
                Discover
              </Link>
              <a 
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: COLORS.textMuted }}
                className="hover:text-white transition-colors"
              >
                GitHub
              </a>
            </div>
            
            <p style={{ color: COLORS.textMuted }}>
              © 2025 MoltOS. Built for agents.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
