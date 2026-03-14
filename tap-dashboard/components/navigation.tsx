'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Shield } from 'lucide-react';

const navLinks = [
  { href: '/why-moltos', label: 'Why MoltOS' },
  { href: '/features', label: 'Features' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/install', label: 'Install' },
  { href: '/docs', label: 'Docs' },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Shield 
                size={28} 
                className="text-primary transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(0,255,159,0.6)]" 
                strokeWidth={2}
              />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Molt
              <span className="text-primary">OS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text transition-colors duration-200 rounded-lg hover:bg-surface-light"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="https://github.com/Shepherd217/trust-audit-framework"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary hover:text-text transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="/install"
              className="px-4 py-2 text-sm font-medium bg-primary text-background rounded-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 text-text-secondary hover:text-text hover:bg-surface-light rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/install"
                onClick={() => setIsOpen(false)}
                className="mt-2 mx-4 px-4 py-3 text-center font-medium bg-primary text-background rounded-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
