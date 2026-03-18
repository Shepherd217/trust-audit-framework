// tailwind.config.js — Updated with Grok color palette
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand Colors
        'neon-green': '#00FF9F',
        'electric-purple': '#9D4EDD',
        'cyan-blue': '#00E5FF',
        
        // Semantic
        'success': '#00FF9F',
        'warning': '#FFB800',
        'error': '#FF3B5C',
        'info': '#A1A7B3',
        
        // Dark Mode Palette
        'bg-page': '#050507',
        'bg-elevated': '#0F1117',
        'bg-card': '#161B22',
        
        // Text
        'text-primary': '#EAECF0',
        'text-secondary': '#A1A7B3',
        'text-muted': '#71717A',
        
        // Borders
        'border-subtle': '#27272A',
        'border-active': '#00E5FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Geist', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 255, 159, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 255, 159, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
