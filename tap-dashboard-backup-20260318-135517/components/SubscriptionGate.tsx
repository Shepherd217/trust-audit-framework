'use client';

/**
 * SubscriptionGate Component
 * Blocks access to content if user's subscription tier is insufficient
 * Shows upgrade prompt for restricted features
 */

import React, { useEffect, useState } from 'react';
import { 
  SubscriptionTier, 
  TIER_CONFIG, 
  getClientSubscription,
  meetsMinimumTier,
  getUpgradeInfo,
  hasAgentAccess,
  hasFeatureAccess,
  checkClientAgentAccess,
  checkClientFeatureAccess,
  setMockUser,
} from '@/lib/auth';

// ============================================================================
// Types
// ============================================================================

interface SubscriptionGateProps {
  /** Minimum required tier to access content */
  requiredTier?: SubscriptionTier;
  /** Required agent type for agent-specific features */
  requiredAgent?: string;
  /** Required feature name for feature-specific gating */
  requiredFeature?: string;
  /** Content to render if access is granted */
  children: React.ReactNode;
  /** Custom fallback component when access is denied */
  fallback?: React.ReactNode;
  /** Whether to show the upgrade prompt (default: true) */
  showUpgradePrompt?: boolean;
  /** Custom title for the upgrade prompt */
  title?: string;
  /** Custom message for the upgrade prompt */
  message?: string;
  /** Called when access is granted or denied */
  onAccessChange?: (hasAccess: boolean) => void;
}

interface UpgradePromptProps {
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  requiredAgent?: string;
  requiredFeature?: string;
  title?: string;
  message?: string;
  onUpgrade?: () => void;
}

// ============================================================================
// Upgrade Prompt Component
// ============================================================================

const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  currentTier,
  requiredTier,
  requiredAgent,
  requiredFeature,
  title,
  message,
  onUpgrade,
}) => {
  const upgradeInfo = getUpgradeInfo(currentTier);
  const requiredTierConfig = TIER_CONFIG[requiredTier];
  
  // Generate appropriate title and message
  const promptTitle = title || 
    (requiredAgent 
      ? `${requiredTierConfig.name} Required for ${requiredAgent.charAt(0).toUpperCase() + requiredAgent.slice(1)} Agent`
      : requiredFeature
        ? `${requiredTierConfig.name} Required`
        : 'Upgrade Required');
  
  const promptMessage = message ||
    (requiredAgent
      ? `The ${requiredAgent} Agent requires a ${requiredTierConfig.name} subscription or higher.`
      : requiredFeature
        ? `This feature requires a ${requiredTierConfig.name} subscription or higher.`
        : `This content requires a ${requiredTierConfig.name} subscription or higher.`);

  const handleUpgrade = () => {
    // In production, this would redirect to Stripe checkout
    // For demo, we'll show a mock upgrade dialog
    if (onUpgrade) {
      onUpgrade();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Lock Icon */}
        <div style={styles.iconContainer}>
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={styles.lockIcon}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Title */}
        <h2 style={styles.title}>{promptTitle}</h2>

        {/* Message */}
        <p style={styles.message}>{promptMessage}</p>

        {/* Current Tier Badge */}
        <div style={styles.currentTierBadge}>
          <span style={styles.currentTierLabel}>Current Plan: </span>
          <span style={styles.currentTierValue}>{TIER_CONFIG[currentTier].name}</span>
        </div>

        {/* Upgrade Options */}
        {upgradeInfo.nextTier && (
          <div style={styles.upgradeSection}>
            <div style={styles.upgradeCard}>
              <div style={styles.upgradeHeader}>
                <span style={styles.upgradeTierName}>{TIER_CONFIG[upgradeInfo.nextTier].name}</span>
                <span style={styles.upgradePrice}>${upgradeInfo.price}/mo</span>
              </div>
              
              {upgradeInfo.features.length > 0 && (
                <div style={styles.featuresList}>
                  <p style={styles.featuresTitle}>What you\'ll get:</p>
                  <ul style={styles.featuresUl}>
                    {upgradeInfo.features.map((feature, index) => (
                      <li key={index} style={styles.featureItem}>
                        <span style={styles.checkmark}>✓</span> {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button 
                onClick={handleUpgrade}
                style={styles.upgradeButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* Comparison Link */}
        <a 
          href="#pricing" 
          style={styles.compareLink}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6b7280';
          }}
        >
          Compare all plans →
        </a>

        {/* Demo Toggle (for testing) */}
        <div style={styles.demoSection}>
          <p style={styles.demoLabel}>Demo: Switch tier</p>
          <div style={styles.demoButtons}>
            {(['starter', 'builder', 'pro', 'enterprise'] as SubscriptionTier[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setMockUser(`demo-${tier}`)}
                style={{
                  ...styles.demoButton,
                  ...(currentTier === tier ? styles.demoButtonActive : {}),
                }}
              >
                {TIER_CONFIG[tier].name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main SubscriptionGate Component
// ============================================================================

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  requiredTier,
  requiredAgent,
  requiredFeature,
  children,
  fallback,
  showUpgradePrompt = true,
  title,
  message,
  onAccessChange,
}) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('starter');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check access on mount and when requirements change
    const checkAccess = () => {
      const subscription = getClientSubscription();
      setCurrentTier(subscription.tier);

      let accessGranted = true;

      // Check tier requirement
      if (requiredTier) {
        accessGranted = accessGranted && meetsMinimumTier(subscription.tier, requiredTier);
      }

      // Check agent requirement
      if (requiredAgent) {
        accessGranted = accessGranted && checkClientAgentAccess(requiredAgent);
      }

      // Check feature requirement
      if (requiredFeature) {
        accessGranted = accessGranted && checkClientFeatureAccess(requiredFeature);
      }

      setHasAccess(accessGranted);
      setIsLoading(false);

      if (onAccessChange) {
        onAccessChange(accessGranted);
      }
    };

    checkAccess();

    // Listen for storage changes (in case user switches tiers)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moltos_auth') {
        checkAccess();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [requiredTier, requiredAgent, requiredFeature, onAccessChange]);

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
      </div>
    );
  }

  // Access granted - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied - render fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <UpgradePrompt
        currentTier={currentTier}
        requiredTier={requiredTier || 'pro'}
        requiredAgent={requiredAgent}
        requiredFeature={requiredFeature}
        title={title}
        message={message}
        onUpgrade={() => {
          // Refresh to apply new tier (in demo mode)
          window.location.reload();
        }}
      />
    );
  }

  return null;
};

// ============================================================================
// Trading Agent Gate (Pre-configured for Trading Agent)
// ============================================================================

export const TradingAgentGate: React.FC<Omit<SubscriptionGateProps, 'requiredTier' | 'requiredAgent'>> = (props) => {
  return (
    <SubscriptionGate
      requiredTier="pro"
      requiredAgent="trading"
      title="Trading Agent Access Required"
      message="The Trading Agent is available on Pro and Enterprise plans. Upgrade to unlock automated trading capabilities."
      {...props}
    />
  );
};

// ============================================================================
// Feature Gate (Pre-configured for feature-based gating)
// ============================================================================

interface FeatureGateProps extends Omit<SubscriptionGateProps, 'requiredTier' | 'requiredAgent' | 'requiredFeature'> {
  feature: string;
  minTier?: SubscriptionTier;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, minTier, ...props }) => {
  return (
    <SubscriptionGate
      requiredFeature={feature}
      requiredTier={minTier}
      {...props}
    />
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    padding: '24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb',
  },
  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  lockIcon: {
    color: '#9ca3af',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '12px',
    marginTop: 0,
  },
  message: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  currentTierBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '9999px',
    marginBottom: '24px',
  },
  currentTierLabel: {
    fontSize: '14px',
    color: '#6b7280',
  },
  currentTierValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  upgradeSection: {
    marginBottom: '24px',
  },
  upgradeCard: {
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'left',
  },
  upgradeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  upgradeTierName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
  },
  upgradePrice: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#3b82f6',
  },
  featuresList: {
    marginBottom: '20px',
  },
  featuresTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '12px',
  },
  featuresUl: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  featureItem: {
    fontSize: '14px',
    color: '#4b5563',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  checkmark: {
    color: '#10b981',
    fontWeight: 700,
  },
  upgradeButton: {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  compareLink: {
    display: 'inline-block',
    fontSize: '14px',
    color: '#6b7280',
    textDecoration: 'none',
    marginBottom: '24px',
    transition: 'color 0.2s ease',
  },
  demoSection: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '24px',
  },
  demoLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  demoButtons: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  demoButton: {
    padding: '6px 12px',
    fontSize: '12px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  demoButtonActive: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderColor: '#3b82f6',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

// Add keyframes for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default SubscriptionGate;
