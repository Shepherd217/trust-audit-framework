import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function getTierFromScore(score: number): { name: string; color: string; bg: string } {
  if (score >= 90) return { name: 'Diamond', color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
  if (score >= 80) return { name: 'Platinum', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
  if (score >= 70) return { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
  if (score >= 60) return { name: 'Silver', color: 'text-slate-400', bg: 'bg-slate-400/10' };
  return { name: 'Bronze', color: 'text-amber-600', bg: 'bg-amber-600/10' };
}
