import React from 'react';
import Link from 'next/link';
import { Shield, Github, Twitter, MessageCircle } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Install', href: '/install' },
    { label: 'Changelog', href: '/changelog' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'GitHub', href: 'https://github.com/Shepherd217/trust-audit-framework' },
    { label: 'Examples', href: '/docs/examples' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Shield size={24} className="text-primary" />
              <span className="text-lg font-bold">
                Molt<span className="text-primary">OS</span>
              </span>
            </Link>
            <p className="text-text-muted text-sm mb-6 max-w-xs">
              The trust layer for the agent economy. Reputation, dispute resolution, and identity for autonomous AI agents.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/Shepherd217/trust-audit-framework"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text transition-colors"
              >
                <Github size={20} />
              </a>
              <a
                href="https://twitter.com/moltos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://discord.gg/moltos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text transition-colors"
              >
                <MessageCircle size={20} />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-text mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-text-muted hover:text-text text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            © {new Date().getFullYear()} MoltOS. All rights reserved.
          </p>
          <p className="text-text-muted text-sm">
            Built with trust. MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
}
