import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#030508',
        deep: '#080d14',
        surface: '#0d1520',
        panel: '#111d2e',
        border: '#1a2d45',
        'border-hi': '#234060',
        // New lilac/purple accent colors (replacing amber/teal)
        accent: {
          lilac: '#c4b5fd',
          violet: '#a78bfa',
          purple: '#8b5cf6',
          deep: '#7c3aed',
        },
        // Keep for backward compatibility, map to new lilac/purple colors
        amber: {
          DEFAULT: '#a78bfa',  // violet
          dim: '#8b5cf6',
          glow: 'rgba(167,139,250,0.3)',
        },
        teal: {
          DEFAULT: '#c4b5fd',  // lilac
          dim: '#a78bfa',
          glow: 'rgba(196,181,253,0.3)',
        },
        molt: {
          blue: '#3b82f6',
          purple: '#a855f7',
          red: '#ff4455',
          green: '#28c840',
        },
        text: {
          hi: '#f0f4f8',
          mid: '#7a9ab8',
          lo: '#3a5570',
        },
        tier: {
          bronze: '#cd7f32',
          silver: '#c0c0c0',
          gold: '#ffd700',
          platinum: '#e5e4e2',
          diamond: '#b9f2ff',
        },
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      backgroundImage: {
        'gradient-violet-cyan': 'linear-gradient(135deg, #a855f7, #3b82f6, #06b6d4)',
        'grid-pattern': `linear-gradient(rgba(26,45,69,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(26,45,69,0.3) 1px, transparent 1px)`,
      },
      boxShadow: {
        'amber': '0 0 40px rgba(139, 92, 246, 0.3), 0 0 80px rgba(139, 92, 246, 0.1)',
        'teal': '0 0 40px rgba(6, 182, 212, 0.3), 0 0 80px rgba(6, 182, 212, 0.1)',
        'card': '0 24px 64px rgba(0,0,0,0.5)',
      },
      animation: {
        'breathe': 'breathe 3s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'ticker': 'ticker 28s linear infinite',
        'fade-up': 'fadeUp 0.6s ease forwards',
        'spin-slow': 'spin 8s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%,100%': { filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.6))' },
          '50%': { filter: 'drop-shadow(0 0 16px rgba(59, 130, 246, 0.9))' },
        },
        pulseDot: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.5)' },
          '50%': { boxShadow: '0 0 0 6px rgba(139, 92, 246, 0)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
