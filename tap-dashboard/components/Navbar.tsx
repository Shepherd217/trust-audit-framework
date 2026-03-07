'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/join', label: 'Join' },
    { href: '/waitlist', label: 'Waitlist' },
    { href: '/about', label: 'About' },
    { href: '/docs', label: 'Docs' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050507]/95 backdrop-blur-md border-b border-[#27272A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <span className="text-3xl">🦞</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#00FF9F] to-[#00E5FF] bg-clip-text text-transparent">
            TAP
          </span>
        </Link>

        {/* TEMPORARY: Hamburger only on ALL screen sizes */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-white p-2"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu - works on all screens */}
      {mobileOpen && (
        <div className="bg-[#161B22] border-b border-[#27272A] px-4 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block py-3 text-lg ${pathname === link.href ? 'text-[#00FF9F]' : 'text-white/80'}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
