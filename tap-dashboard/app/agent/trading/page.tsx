'use client';

/**
 * Trading Agent Page
 * Demonstrates subscription gating - requires Pro tier or higher
 */

import { TradingAgentGate } from '@/components/SubscriptionGate';

// ============================================================================
// Trading Agent Content Component
// ============================================================================

const TradingAgentContent = () => {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.iconWrapper}>
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={styles.icon}
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>
        <div>
          <h1 style={styles.title}>Trading Agent</h1>
          <p style={styles.subtitle}>Automated trading strategies and portfolio management</p>
        </div>
      </header>

      <div style={styles.grid}>
        {/* Portfolio Overview */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Portfolio Overview</h3>
          <div style={styles.statGrid}>
            <div style={styles.stat}>
              <span style={styles.statValue}>$124,532.89</span>
              <span style={styles.statLabel}>Total Value</span>
            </div>
            <div style={styles.stat}>
              <span style={{...styles.statValue, color: '#10b981'}}>+12.4%</span>
              <span style={styles.statLabel}>24h Change</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>8</span>
              <span style={styles.statLabel}>Active Strategies</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>94.2%</span>
              <span style={styles.statLabel}>Win Rate</span>
            </div>
          </div>
        </div>

        {/* Active Strategies */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Active Strategies</h3>
          <div style={styles.strategyList}>
            {[
              { name: 'Momentum Alpha', status: 'Active', pnl: '+8.2%', type: 'Long' },
              { name: 'Mean Reversion', status: 'Active', pnl: '+3.4%', type: 'Short' },
              { name: 'Arbitrage Bot', status: 'Paused', pnl: '+12.1%', type: 'Neutral' },
              { name: 'ML Prediction', status: 'Active', pnl: '+15.7%', type: 'Long' },
            ].map((strategy, i) => (
              <div key={i} style={styles.strategyItem}>
                <div style={styles.strategyInfo}>
                  <span style={styles.strategyName}>{strategy.name}</span>
                  <span style={{
                    ...styles.strategyType,
                    backgroundColor: strategy.type === 'Long' ? '#dcfce7' : strategy.type === 'Short' ? '#fee2e2' : '#f3f4f6',
                    color: strategy.type === 'Long' ? '#166534' : strategy.type === 'Short' ? '#991b1b' : '#374151',
                  }}>
                    {strategy.type}
                  </span>
                </div>
                <div style={styles.strategyMetrics}>
                  <span style={{
                    ...styles.strategyPnl,
                    color: strategy.pnl.startsWith('+') ? '#10b981' : '#ef4444',
                  }}>
                    {strategy.pnl}
                  </span>
                  <span style={{
                    ...styles.strategyStatus,
                    color: strategy.status === 'Active' ? '#10b981' : '#f59e0b',
                  }}>
                    ● {strategy.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Features */}
        <div style={{...styles.card, gridColumn: 'span 2'}}>
          <h3 style={styles.cardTitle}>Advanced Features</h3>
          <div style={styles.featureGrid}>
            {[
              { 
                icon: '🤖', 
                title: 'AI-Powered Signals', 
                desc: 'Machine learning models analyze market patterns',
                available: true,
              },
              { 
                icon: '⚡', 
                title: 'Real-Time Execution', 
                desc: 'Sub-second order execution with smart routing',
                available: true,
              },
              { 
                icon: '📊', 
                title: 'Portfolio Optimization', 
                desc: 'Modern portfolio theory with risk management',
                available: true,
              },
              { 
                icon: '🔔', 
                title: 'Smart Alerts', 
                desc: 'Customizable notifications for market events',
                available: true,
              },
              { 
                icon: '🔒', 
                title: 'Risk Controls', 
                desc: 'Automated stop-loss and position sizing',
                available: true,
              },
              { 
                icon: '📈', 
                title: 'Backtesting Engine', 
                desc: 'Test strategies against historical data',
                available: true,
              },
            ].map((feature, i) => (
              <div key={i} style={styles.featureItem}>
                <span style={styles.featureIcon}>{feature.icon}</span>
                <div>
                  <h4 style={styles.featureTitle}>{feature.title}</h4>
                  <p style={styles.featureDesc}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Page Component with Subscription Gate
// ============================================================================

export default function TradingAgentPage() {
  return (
    <TradingAgentGate>
      <TradingAgentContent />
    </TradingAgentGate>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  iconWrapper: {
    width: '56px',
    height: '56px',
    backgroundColor: '#3b82f6',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#ffffff',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: '4px 0 0 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 16px 0',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  },
  strategyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  strategyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  strategyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  strategyName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  strategyType: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  strategyMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  strategyPnl: {
    fontSize: '14px',
    fontWeight: 600,
  },
  strategyStatus: {
    fontSize: '12px',
    fontWeight: 500,
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  featureIcon: {
    fontSize: '24px',
    lineHeight: 1,
  },
  featureTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 4px 0',
  },
  featureDesc: {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
    lineHeight: 1.4,
  },
};
