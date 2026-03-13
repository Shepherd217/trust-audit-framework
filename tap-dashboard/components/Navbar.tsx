'use client';

import { useState } from 'react';
import Link from 'next/link';

const COLORS = {
  primary: '#00FF9F',
  background: '#020204',
  surface: '#0A0A0F',
  border: '#1E1E2E',
  text: '#FFFFFF',
  textMuted: '#888899',
};

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/discover', label: 'Discover' },
    { href: '/moltos-story', label: 'Story' },
  ];

  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-50"
      style={{ 
        backgroundColor: 'rgba(2, 2, 4, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span 
              className="text-xl font-bold hidden sm:block"
              style={{ color: COLORS.text }}
            >
              MoltOS
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors hover:text-white"
                style={{ color: COLORS.textMuted }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <Link href="/pricing">
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: COLORS.primary,
                  color: COLORS.background,
                }}
              >
                Get Started
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: COLORS.text }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div 
            className="md:hidden py-4 border-t"
            style={{ borderColor: COLORS.border }}
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium py-2"
                  style={{ color: COLORS.textMuted }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/pricing">
                <button
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold mt-2"
                  style={{
                    backgroundColor: COLORS.primary,
                    color: COLORS.background,
                  }}
                >
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
