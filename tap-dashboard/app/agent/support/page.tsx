'use client';

/**
 * Support Agent Page
 * Demonstrates Builder tier access - requires Builder or higher
 */

import { SubscriptionGate } from '@/components/SubscriptionGate';

const SupportAgentContent = () => {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{...styles.iconWrapper, backgroundColor: '#10b981'}}>
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={styles.icon}
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <div>
          <h1 style={styles.title}>Support Agent</h1>
          <p style={styles.subtitle}>Automated customer support and ticket management</p>
        </div>
      </header>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Active Tickets</h3>
          <div style={styles.ticketList}>
            {[
              { id: '#4821', subject: 'API Integration Help', status: 'Open', priority: 'High' },
              { id: '#4820', subject: 'Billing Question', status: 'In Progress', priority: 'Medium' },
              { id: '#4819', subject: 'Feature Request', status: 'Resolved', priority: 'Low' },
            ].map((ticket) => (
              <div key={ticket.id} style={styles.ticketItem}>
                <div>
                  <span style={styles.ticketId}>{ticket.id}</span>
                  <p style={styles.ticketSubject}>{ticket.subject}</p>
                </div>
                <div style={styles.ticketMeta}>
                  <span style={{
                    ...styles.priority,
                    backgroundColor: ticket.priority === 'High' ? '#fee2e2' : ticket.priority === 'Medium' ? '#fef3c7' : '#f3f4f6',
                    color: ticket.priority === 'High' ? '#991b1b' : ticket.priority === 'Medium' ? '#92400e' : '#374151',
                  }}>
                    {ticket.priority}
                  </span>
                  <span style={styles.status}>{ticket.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Agent Stats</h3>
          <div style={styles.statsList}>
            {[
              { label: 'Tickets Resolved Today', value: '24' },
              { label: 'Avg Response Time', value: '2.3 min' },
              { label: 'Customer Satisfaction', value: '94%' },
              { label: 'Active Conversations', value: '7' },
            ].map((stat) => (
              <div key={stat.label} style={styles.statRow}>
                <span style={styles.statLabel}>{stat.label}</span>
                <span style={styles.statValue}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SupportAgentPage() {
  return (
    <SubscriptionGate
      requiredTier="builder"
      requiredAgent="support"
      title="Support Agent Access Required"
      message="The Support Agent is available on Builder, Pro, and Enterprise plans. Upgrade to unlock automated customer support."
    >
      <SupportAgentContent />
    </SubscriptionGate>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
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
    gridTemplateColumns: '2fr 1fr',
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
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  ticketItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  ticketId: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 500,
  },
  ticketSubject: {
    fontSize: '14px',
    color: '#111827',
    fontWeight: 500,
    margin: '4px 0 0 0',
  },
  ticketMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  priority: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  status: {
    fontSize: '12px',
    color: '#6b7280',
  },
  statsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid #f3f4f6',
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
};
