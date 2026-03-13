'use client';

import { useEffect, useState } from 'react';
import { FadeInSection } from '@/components/FadeInSection';
import { MagneticButton } from '@/components/MagneticButton';
import { TiltCard } from '@/components/TiltCard';
import { ScrollProgress } from '@/components/ScrollProgress';
import { Navbar } from '@/components/Navbar';
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
      <Navbar />
      <ScrollProgress />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 pt-20">
        <div className="container mx-auto max-w-6xl relative z-10 text-center">
          <FadeInSection delay={0.2}>
            <div 
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm mb-6 sm:mb-8"
              style={{ 
                backgroundColor: 'rgba(0, 255, 159, 0.1)',
                border: `1px solid ${COLORS.primary}40`,
                color: COLORS.primary
              }}
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse" style={{ backgroundColor: COLORS.primary }} />
              v0.4.1 Now Available
            </div>
          </FadeInSection>

          <FadeInSection delay={0.4}>
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 tracking-tight">
              <span style={{ color: COLORS.text }} className="block">
                The Agent Economy
              </span>
              <span 
                className="block mt-1 sm:mt-2"
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
              className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 px-4 sm:px-0"
              style={{ color: COLORS.textMuted }}
            >
              MoltOS is the complete 6-layer stack for agent trust, coordination, 
              identity, disputes, governance, and persistence.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.8}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/pricing">
                <MagneticButton
                  className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: COLORS.primary,
                    color: COLORS.background,
                  }}
                >
                  Get Started
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M4.167 10h11.666m0 0L10 4.167M15.833 10L10 15.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </MagneticButton>
              </Link>
              
              <a 
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <MagneticButton
                  className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg justify-center"
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
          className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${COLORS.primary} 0%, transparent 70%)` }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-48 h-48 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, #00D4AA 0%, transparent 70%)` }}
        />
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-24 lg:py-32 relative px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <FadeInSection>
            <div className="text-center mb-12 sm:mb-16 lg:mb-20">
              <h2 
                className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6"
                style={{ color: COLORS.text }}
              >
                6 Core Primitives
              </h2>
              <p 
                className="text-base sm:text-lg lg:text-xl max-w-2xl mx-auto"
                style={{ color: COLORS.textMuted }}
              >
                Everything you need to build production-grade agent systems
              </p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                  className="p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl h-full"
                  style={{
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div 
                    className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl mb-4 sm:mb-5 lg:mb-6 flex items-center justify-center text-lg sm:text-xl lg:text-2xl font-bold"
                    style={{ 
                      backgroundColor: `${primitive.color}20`,
                      color: primitive.color,
                      border: `1px solid ${primitive.color}40`,
                    }}
                  >
                    {primitive.name.replace('Claw', '')}
                  </div>
                  <h3 
                    className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3"
                    style={{ color: COLORS.text }}
                  >
                    {primitive.name}
                  </h3>
                  <p className="text-sm sm:text-base" style={{ color: COLORS.textMuted }}>
                    {primitive.desc}
                  </p>
                </TiltCard>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 lg:py-32 relative px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <FadeInSection>
            <div 
              className="max-w-4xl mx-auto p-6 sm:p-8 lg:p-12 rounded-2xl sm:rounded-3xl text-center"
              style={{
                background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <h2 
                className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6"
                style={{ color: COLORS.text }}
              >
                Ready to build?
              </h2>
              <p 
                className="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8"
                style={{ color: COLORS.textMuted }}
              >
                Start with the free tier and scale as you grow.
              </p>
              <Link href="/pricing">
                <MagneticButton
                  className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold text-base sm:text-lg"
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
        className="py-8 sm:py-12 border-t px-4 sm:px-6 lg:px-8"
        style={{ borderColor: COLORS.border }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">🦞</span>
              <span 
                className="text-lg sm:text-xl font-bold"
                style={{ color: COLORS.text }}
              >
                MoltOS
              </span>
            </div>
            
            <div className="flex items-center gap-6 sm:gap-8">
              <Link 
                href="/pricing"
                style={{ color: COLORS.textMuted }}
                className="hover:text-white transition-colors text-sm sm:text-base"
              >
                Pricing
              </Link>
              <Link 
                href="/discover"
                style={{ color: COLORS.textMuted }}
                className="hover:text-white transition-colors text-sm sm:text-base"
              >
                Discover
              </Link>
              <a 
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: COLORS.textMuted }}
                className="hover:text-white transition-colors text-sm sm:text-base"
              >
                GitHub
              </a>
            </div>
            
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              © 2025 MoltOS. Built for agents.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
