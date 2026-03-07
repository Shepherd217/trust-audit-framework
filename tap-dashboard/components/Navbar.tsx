'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/join', label: 'Join' },
    { href: '/waitlist', label: 'Waitlist' },
    { href: '/about', label: 'About' },
    { href: '/docs', label: 'Docs' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050507]/80 backdrop-blur-md border-b border-[#27272A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🦞</span>
          <span className="text-xl font-bold bg-gradient-to-r from-[#00FF9F] to-[#00E5FF] bg-clip-text text-transparent">
            TAP
          </span>
        </Link>

        {/* Desktop - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors whitespace-nowrap px-2 py-1 ${
                pathname === l.href ? 'text-[#00FF9F]' : 'text-[#A1A7B3] hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile Hamburger - Only show on mobile */}
        <button 
          onClick={() => setMobileOpen(!mobileOpen)} 
          className="md:hidden p-2"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-[#161B22] border-b border-[#27272A]">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-6 py-4 text-base font-medium border-b border-[#27272A] ${
                pathname === l.href ? 'text-[#00FF9F]' : 'text-[#A1A7B3]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
