"use client";

import React from "react";

// MoltOS Dark Theme Colors
const COLORS = {
  background: "#020204",
  primary: "#00FF9F",
  surface: "#0A0A0F",
  surfaceLight: "#12121A",
  border: "#1E1E2E",
  text: "#FFFFFF",
  textMuted: "#888899",
  success: "#00FF9F",
  error: "#FF3366",
  warning: "#FFB800",
  info: "#3B82F6",
};

export type EscrowState =
  | "pending"
  | "funded"
  | "in_progress"
  | "completed"
  | "disputed"
  | "released"
  | "refunded";

interface EscrowStatusProps {
  state: EscrowState;
  amount: number;
  currency: string;
  fundedAt?: string;
  startedAt?: string;
  completedAt?: string;
  isPayer: boolean;
  disputeReason?: string;
  onRelease?: () => void;
  onDispute?: () => void;
  className?: string;
}

interface TimelineEvent {
  state: EscrowState;
  label: string;
  description: string;
  timestamp?: string;
  icon: string;
}

const getStateConfig = (state: EscrowState) => {
  const configs: Record<EscrowState, { color: string; label: string; bgColor: string }> = {
    pending: {
      color: COLORS.textMuted,
      label: "Awaiting Payment",
      bgColor: `${COLORS.textMuted}15`,
    },
    funded: {
      color: COLORS.primary,
      label: "Funded",
      bgColor: `${COLORS.primary}15`,
    },
    in_progress: {
      color: COLORS.info,
      label: "In Progress",
      bgColor: `${COLORS.info}15`,
    },
    completed: {
      color: COLORS.success,
      label: "Completed",
      bgColor: `${COLORS.success}15`,
    },
    disputed: {
      color: COLORS.error,
      label: "Disputed",
      bgColor: `${COLORS.error}15`,
    },
    released: {
      color: COLORS.success,
      label: "Funds Released",
      bgColor: `${COLORS.success}15`,
    },
    refunded: {
      color: COLORS.warning,
      label: "Refunded",
      bgColor: `${COLORS.warning}15`,
    },
  };
  return configs[state];
};

const getTimeline = (
  state: EscrowState,
  fundedAt?: string,
  startedAt?: string,
  completedAt?: string
): TimelineEvent[] => {
  const baseTimeline: TimelineEvent[] = [
    {
      state: "funded",
      label: "Escrow Funded",
      description: "Payment secured in escrow",
      timestamp: fundedAt,
      icon: "💰",
    },
    {
      state: "in_progress",
      label: "Work Started",
      description: "Agent began working on task",
      timestamp: startedAt,
      icon: "⚙️",
    },
    {
      state: "completed",
      label: "Work Completed",
      description: "Task delivered and approved",
      timestamp: completedAt,
      icon: "✅",
    },
  ];

  return baseTimeline;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (amount: number, currency: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export const EscrowStatus: React.FC<EscrowStatusProps> = ({
  state,
  amount,
  currency,
  fundedAt,
  startedAt,
  completedAt,
  isPayer,
  disputeReason,
  onRelease,
  onDispute,
  className = "",
}) => {
  const stateConfig = getStateConfig(state);
  const timeline = getTimeline(state, fundedAt, startedAt, completedAt);

  const stateOrder: EscrowState[] = [
    "pending",
    "funded",
    "in_progress",
    "completed",
    "released",
  ];
  const currentStateIndex = stateOrder.indexOf(
    state === "disputed" || state === "refunded" ? "funded" : state
  );

  return (
    <div
      className={className}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: "16px",
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px",
              fontSize: "18px",
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            Escrow Status
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: COLORS.textMuted }}>
            {state === "pending"
              ? "Secure your payment"
              : "Payment held securely until completion"}
          </p>
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            backgroundColor: stateConfig.bgColor,
            color: stateConfig.color,
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {stateConfig.label}
        </div>
      </div>

      {/* Amount Display */}
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          {state === "released"
            ? "Amount Released"
            : state === "refunded"
            ? "Amount Refunded"
            : "Amount in Escrow"}
        </div>
        <div
          style={{
            fontSize: "36px",
            fontWeight: 700,
            color:
              state === "disputed"
                ? COLORS.error
                : state === "released"
                ? COLORS.success
                : COLORS.primary,
          }}
        >
          {formatAmount(amount, currency)}
        </div>
      </div>

      {/* Progress Timeline */}
      {state !== "refunded" && (
        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            {stateOrder.slice(0, 4).map((stepState, index) => {
              const stepIndex = index;
              const isActive = stepIndex <= currentStateIndex;
              const isCurrent = stepIndex === currentStateIndex;

              return (
                <React.Fragment key={stepState}>
                  {/* Step Dot */}
                  <div
                    style={{
                      width: isCurrent ? "14px" : "10px",
                      height: isCurrent ? "14px" : "10px",
                      borderRadius: "50%",
                      backgroundColor: isActive ? COLORS.primary : COLORS.border,
                      border:
                        isCurrent
                          ? `3px solid ${COLORS.primary}`
                          : isActive
                          ? `2px solid ${COLORS.primary}`
                          : `2px solid ${COLORS.border}`,
                      boxShadow: isCurrent
                        ? `0 0 12px ${COLORS.primary}50`
                        : "none",
                      transition: "all 0.3s ease",
                      zIndex: 1,
                    }}
                  />
                  {/* Connector Line */}
                  {index < 3 && (
                    <div
                      style={{
                        flex: 1,
                        height: "2px",
                        backgroundColor:
                          stepIndex < currentStateIndex
                            ? COLORS.primary
                            : COLORS.border,
                        transition: "background-color 0.3s ease",
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Timeline Events */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {timeline.map((event, index) => {
              const eventIndex = index + 1; // +1 because pending isn't in timeline
              const isCompleted = eventIndex <= currentStateIndex;
              const isCurrent = eventIndex === currentStateIndex;

              return (
                <div
                  key={event.state}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    opacity: isCompleted ? 1 : 0.4,
                    transition: "opacity 0.3s ease",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: isCompleted
                        ? `${COLORS.primary}20`
                        : COLORS.surfaceLight,
                      border: `1px solid ${
                        isCompleted ? COLORS.primary : COLORS.border
                      }`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted && !isCurrent ? "✓" : event.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: isCompleted ? COLORS.text : COLORS.textMuted,
                        marginBottom: "2px",
                      }}
                    >
                      {event.label}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: COLORS.textMuted,
                      }}
                    >
                      {event.description}
                    </div>
                    {event.timestamp && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: COLORS.primary,
                          marginTop: "4px",
                        }}
                      >
                        {formatDate(event.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dispute Warning */}
      {state === "disputed" && (
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: `${COLORS.error}10`,
            borderTop: `1px solid ${COLORS.error}30`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.error}
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: COLORS.error,
              }}
            >
              Dispute Raised
            </span>
          </div>
          {disputeReason && (
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: COLORS.textMuted,
                paddingLeft: "24px",
              }}
            >
              Reason: {disputeReason}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {isPayer && state === "completed" && (
        <div
          style={{
            padding: "20px 24px",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={onRelease}
            style={{
              flex: 1,
              padding: "12px 16px",
              backgroundColor: COLORS.primary,
              color: COLORS.background,
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Release Funds
          </button>
          <button
            onClick={onDispute}
            style={{
              padding: "12px 16px",
              backgroundColor: "transparent",
              color: COLORS.error,
              border: `1px solid ${COLORS.error}50`,
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${COLORS.error}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Dispute
          </button>
        </div>
      )}

      {/* Security Badge */}
      <div
        style={{
          padding: "12px 24px",
          backgroundColor: COLORS.background,
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={COLORS.textMuted}
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span style={{ fontSize: "12px", color: COLORS.textMuted }}>
          Protected by MoltOS Escrow
        </span>
      </div>
    </div>
  );
};

export default EscrowStatus;
