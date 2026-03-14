'use client';

import React, { useEffect, useState } from 'react';
import { Scale, Clock, X, ChevronRight, Users, AlertTriangle } from 'lucide-react';

const COLORS = {
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  primary: '#00FF9F',
  text: '#FFFFFF',
  textMuted: '#888899',
  textSecondary: '#A0A0B0',
  success: '#00FF9F',
  warning: '#FFB800',
  error: '#FF3366',
};

export interface CommitteeAlertProps {
  disputeId: string;
  reason: string;
  amount: number;
  currency: string;
  votingEndsAt: string;
  onDismiss?: () => void;
  onViewDispute?: (disputeId: string) => void;
}

export function CommitteeAlert({ 
  disputeId, 
  reason, 
  amount, 
  currency,
  votingEndsAt,
  onDismiss,
  onViewDispute 
}: CommitteeAlertProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(votingEndsAt).getTime();
      const now = Date.now();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeRemaining('Voting closed');
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      
      setIsExpiringSoon(minutes < 5);
      
      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes % 60}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [votingEndsAt]);

  if (!isVisible) return null;

  return (
    <div 
      className="rounded-xl overflow-hidden animate-in slide-in-from-top-2"
      style={{ 
        backgroundColor: COLORS.surface, 
        border: `2px solid ${isExpiringSoon ? COLORS.error : COLORS.primary}`,
        boxShadow: `0 0 20px ${isExpiringSoon ? COLORS.error : COLORS.primary}20`
      }}
    >
      {/* Alert Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ 
          backgroundColor: isExpiringSoon ? `${COLORS.error}10` : `${COLORS.primary}10`,
          borderBottom: `1px solid ${isExpiringSoon ? COLORS.error : COLORS.primary}30`
        }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: isExpiringSoon ? `${COLORS.error}20` : `${COLORS.primary}20` }}
          >
            <Scale size={18} style={{ color: isExpiringSoon ? COLORS.error : COLORS.primary }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: COLORS.text }}>
              Committee Duty Assigned
            </p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              You've been selected as a juror
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            setIsVisible(false);
            onDismiss?.();
          }}
          className="p-1 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: COLORS.textMuted }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Alert Body */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: COLORS.text }}>
              {reason}
            </p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Dispute #{disputeId.slice(0, 8)}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-xl font-bold" style={{ color: COLORS.primary }}>
              ${(amount / 100).toFixed(2)}
            </p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>At stake</p>
          </div>
        </div>

        {/* Timer */}
        <div 
          className="flex items-center gap-2 p-3 rounded-lg mb-4"
          style={{ 
            backgroundColor: isExpiringSoon ? `${COLORS.error}10` : COLORS.surfaceLight,
            border: `1px solid ${isExpiringSoon ? COLORS.error : COLORS.border}40`
          }}
        >
          <Clock 
            size={16} 
            style={{ color: isExpiringSoon ? COLORS.error : COLORS.warning }} 
          />
          <span 
            className="text-sm font-medium"
            style={{ color: isExpiringSoon ? COLORS.error : COLORS.text }}
          >
            {timeRemaining}
          </span>          
          {isExpiringSoon && (
            <span 
              className="ml-auto text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: COLORS.error, color: COLORS.background }}
            >
              Urgent
            </span>
          )}
        </div>

        {/* Rewards Info */}
        <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: COLORS.surfaceLight }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} style={{ color: COLORS.textMuted }} />
            <span className="text-xs" style={{ color: COLORS.textMuted }}>Committee Rewards</span>
          </div>          
          <div className="flex gap-4 text-xs">
            <div>
              <span style={{ color: COLORS.textMuted }}>Participation: </span>
              <span style={{ color: COLORS.success }}>+5 TAP</span>
            </div>
            <div>
              <span style={{ color: COLORS.textMuted }}>Correct vote: </span>
              <span style={{ color: COLORS.success }}>+10 TAP</span>
            </div>
            <div>
              <span style={{ color: COLORS.textMuted }}>Incorrect: </span>
              <span style={{ color: COLORS.error }}>-20 TAP</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => onViewDispute?.(disputeId)}
          className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          style={{ 
            backgroundColor: isExpiringSoon ? COLORS.error : COLORS.primary, 
            color: COLORS.background 
          }}
        >
          Review & Vote
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function CommitteeAlertStack({ 
  alerts, 
  onDismiss, 
  onViewDispute 
}: { 
  alerts: CommitteeAlertProps[];
  onDismiss?: (index: number) => void;
  onViewDispute?: (disputeId: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-full max-w-sm space-y-3">
      {alerts.map((alert, index) => (
        <CommitteeAlert
          key={alert.disputeId}
          {...alert}
          onDismiss={() => onDismiss?.(index)}
          onViewDispute={onViewDispute}
        />
      ))}
    </div>
  );
}

export default CommitteeAlert;
