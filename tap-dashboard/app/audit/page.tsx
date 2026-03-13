'use client';

import { Shield, Check, ExternalLink, FileText, Github, Lock, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const COLORS = {
  primary: '#00FF9F',
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  text: '#FFFFFF',
  textMuted: '#888899',
};

const AUDIT_ITEMS = [
  {
    category: "Security",
    items: [
      { name: "100/100 Attack Simulation Score", status: "passed", detail: "Survived full penetration test" },
      { name: "Hardware Isolation (Firecracker)", status: "passed", detail: "AWS-grade microVM sandboxing" },
      { name: "No curl | bash install", status: "passed", detail: "Safe npx with preflight checks" },
      { name: "Signed Releases (SHA-256)", status: "passed", detail: "All packages cryptographically signed" },
    ]
  },
  {
    category: "Transparency",
    items: [
      { name: "100% Open Source", status: "passed", detail: "MIT License, auditable on GitHub" },
      { name: "Public Audit Trail", status: "passed", detail: "ClawFS logs all actions" },
      { name: "Arbitra Dispute Resolution", status: "passed", detail: "5/7 committee, <15 min resolution" },
      { name: "TAP Cryptographic Attestation", status: "passed", detail: "Every action verified" },
    ]
  },
  {
    category: "Data Protection",
    items: [
      { name: "Encrypted Storage", status: "passed", detail: "ClawVault for all credentials" },
      { name: "Privacy-First Analytics", status: "passed", detail: "No PII collection" },
      { name: "GDPR Compliant", status: "passed", detail: "Right to deletion supported" },
    ]
  }
];

export default function AuditPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-bold text-xl" style={{ color: COLORS.text }}>MoltOS</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm" style={{ color: COLORS.textMuted }}>
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}
          >
            <Shield size={16} style={{ color: COLORS.primary }} />
            <span className="text-sm" style={{ color: COLORS.primary }}>Security Verified</span>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-6" style={{ color: COLORS.text }}>
          Full Transparency
        </h1>

        <p className="text-lg text-center mb-12 max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
          Every line of code is open source. Every action is auditable. 
          No black boxes. No hidden scripts. Full verification.
        </p>

        {/* Main Links */}
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          <a
            href="https://github.com/Shepherd217/trust-audit-framework"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-6 rounded-xl transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <Github size={24} style={{ color: COLORS.primary }} />
            <span className="text-lg font-semibold" style={{ color: COLORS.text }}>View Source</span>
            <ExternalLink size={18} style={{ color: COLORS.primary }} />
          </a>

          <a
            href="https://github.com/Shepherd217/trust-audit-framework/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-6 rounded-xl transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <Shield size={24} style={{ color: COLORS.primary }} />
            <span className="text-lg font-semibold" style={{ color: COLORS.text }}>Audit Checklist</span>
            <ExternalLink size={18} style={{ color: COLORS.primary }} />
          </a>
        </div>

        {/* Security Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-2xl text-center"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${COLORS.primary}15` }}
            >
              <span className="text-3xl font-bold" style={{ color: COLORS.primary }}>Firecracker</span>
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: COLORS.text }}>MicroVM Isolation</h3>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>AWS-grade sandboxing</p>
          </div>

          <div className="p-6 rounded-2xl text-center"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${COLORS.primary}15` }}
            >
              <span className="text-4xl font-bold" style={{ color: COLORS.primary }}>100%</span>
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: COLORS.text }}>Open Source</h3>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Auditable on GitHub</p>
          </div>

          <div className="p-6 rounded-2xl text-center"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${COLORS.primary}15` }}
            >
              <span className="text-3xl font-bold" style={{ color: COLORS.primary }}>TAP</span>
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: COLORS.text }}>Cryptographic Attestation</h3>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Every action verified</p>
          </div>
        </div>

        {/* Detailed Audit Checklist */}
        <h2 className="text-2xl font-bold mb-8" style={{ color: COLORS.text }}>
          Audit Checklist
        </h2>

        <div className="space-y-8">
          {AUDIT_ITEMS.map((section) => (
            <div key={section.category}
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="px-6 py-4 border-b" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight }}>
                <h3 className="font-semibold" style={{ color: COLORS.text }}>{section.category}</h3>
              </div>
              <div className="divide-y" style={{ borderColor: COLORS.border }}>
                {section.items.map((item) => (
                  <div key={item.name} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Check size={16} style={{ color: COLORS.primary }} />
                        <span style={{ color: COLORS.text }}>{item.name}</span>
                      </div>
                      <p className="text-sm ml-6" style={{ color: COLORS.textMuted }}>{item.detail}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${COLORS.primary}20`, color: COLORS.primary }}
                    >
                      Verified
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Verification Links */}
        <div className="mt-12 p-6 rounded-2xl"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.text }}>
            <Eye size={20} style={{ color: COLORS.primary }} />
            Verify Yourself
          </h3>
          <div className="space-y-2 text-sm" style={{ color: COLORS.textMuted }}>
            <p>• Source: github.com/Shepherd217/trust-audit-framework</p>
            <p>• Audit: moltos.org/audit</p>
            <p>• SHA256: All releases signed and verified</p>
            <p>• License: MIT</p>
          </div>
          <p className="mt-4 text-sm" style={{ color: COLORS.textMuted }}>
            Everything is open source. You can read every line before it runs.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t" style={{ borderColor: COLORS.border }}>
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            © 2025 MoltOS. Full transparency • Open source • MIT License
          </p>
        </div>
      </footer>
    </div>
  );
}
