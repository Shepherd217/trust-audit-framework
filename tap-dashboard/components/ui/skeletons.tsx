'use client';

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

// Agent card skeleton
export function AgentCardSkeleton() {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-border-subtle" />
          <div>
            <div className="w-24 h-4 bg-border-subtle rounded mb-2" />
            <div className="w-16 h-3 bg-border-subtle rounded" />
          </div>
        </div>
        <div className="w-16 h-6 bg-border-subtle rounded-full" />
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="w-20 h-8 bg-border-subtle rounded" />
        <div className="w-16 h-6 bg-border-subtle rounded" />
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex-1 h-9 bg-border-subtle rounded-lg" />
        <div className="flex-1 h-9 bg-border-subtle rounded-lg" />
        <div className="w-10 h-9 bg-border-subtle rounded-lg" />
      </div>
    </div>
  );
}

// Stat card skeleton
export function StatCardSkeleton() {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <div className="w-24 h-4 bg-border-subtle rounded mb-2" />
          <div className="w-16 h-8 bg-border-subtle rounded mb-2" />
          <div className="w-32 h-4 bg-border-subtle rounded" />
        </div>
        <div className="w-12 h-12 bg-border-subtle rounded-lg" />
      </div>
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-8 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-border-subtle" />
          <div className="flex-1 text-center md:text-left">
            <div className="w-48 h-8 bg-border-subtle rounded mb-2" />
            <div className="w-32 h-4 bg-border-subtle rounded mb-4" />
            <div className="w-full h-16 bg-border-subtle rounded" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-card border border-border-subtle rounded-xl p-6">
            <div className="w-24 h-4 bg-border-subtle rounded mb-2" />
            <div className="w-16 h-8 bg-border-subtle rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Agent template card skeleton
export function AgentTemplateSkeleton() {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden animate-pulse">
      <div className="h-32 bg-border-subtle" />
      <div className="p-5">
        <div className="w-12 h-12 -mt-11 mb-3 rounded-xl bg-bg-card border-4 border-bg-page" />
        <div className="w-32 h-5 bg-border-subtle rounded mb-2" />
        <div className="w-full h-12 bg-border-subtle rounded mb-4" />
        
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-16 h-6 bg-border-subtle rounded-full" />
          ))}
        </div>
        
        <div className="w-full h-10 bg-border-subtle rounded-lg" />
      </div>
    </div>
  );
}

// List skeleton
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-bg-card border border-border-subtle rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-border-subtle" />
            <div className="flex-1">
              <div className="w-32 h-4 bg-border-subtle rounded mb-2" />
              <div className="w-24 h-3 bg-border-subtle rounded" />
            </div>
            <div className="w-20 h-6 bg-border-subtle rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Page loading spinner
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        className="w-12 h-12 border-4 border-neon-green/20 border-t-neon-green rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// Button loading spinner
export function ButtonLoader({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`w-5 h-5 border-2 border-current border-t-transparent rounded-full ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Full page skeleton for dashboard
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header skeleton */}
      <header className="border-b border-border-subtle bg-bg-elevated/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-border-subtle" />
              <div>
                <div className="w-32 h-5 bg-border-subtle rounded mb-1" />
                <div className="w-48 h-4 bg-border-subtle rounded" />
              </div>
            </div>
            <div className="w-64 h-10 bg-border-subtle rounded-lg" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="w-32 h-6 bg-border-subtle rounded mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <AgentCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
              <div className="w-32 h-6 bg-border-subtle rounded mb-4" />
              <ListSkeleton count={4} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Skeleton shimmer effect wrapper
export function SkeletonShimmer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// Error section component
export function SectionError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="bg-error/10 border border-error/20 rounded-xl p-6 text-center">
      <AlertCircle className="w-8 h-8 text-error mx-auto mb-3" />
      <p className="text-error mb-3">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="px-4 py-2 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
