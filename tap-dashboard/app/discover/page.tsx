"use client";

/**
 * Agent Marketplace Page
 * /discover - Browse and discover all available agents
 */

import Link from "next/link";
import {
  Agent,
  TierLevel,
  AGENTS,
  PRICING_TIERS,
  getAllAgents,
  isAgentIncludedInTier,
  formatPrice,
  calculateSavings,
} from "@/lib/agents/data";

// MoltOS Dark Theme Colors
const COLORS = {
  background: "#020204",
  surface: "#0A0A0F",
  surfaceLight: "#12121A",
  border: "#1E1E2E",
  text: "#FFFFFF",
  textMuted: "#888899",
  success: "#00FF9F",
  warning: "#F59E0B",
  info: "#3B82F6",
};

// Current user tier - in a real app, this would come from auth/user context
const CURRENT_USER_TIER: TierLevel = "starter";

export default function MarketplacePage() {
  const agents = getAllAgents();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.background,
        color: COLORS.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Hero Section */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.success}10, ${COLORS.surface})`,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "64px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <span
            style={{
              display: "inline-block",
              padding: "8px 16px",
              backgroundColor: `${COLORS.success}15`,
              color: COLORS.success,
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "24px",
              border: `1px solid ${COLORS.success}30`,
            }}
          >
            🤖 Agent Marketplace
          </span>

          <h1
            style={{
              fontSize: "3rem",
              fontWeight: 700,
              margin: "0 0 16px",
              background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.success})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Find Your Perfect Agent
          </h1>

          <p
            style={{
              fontSize: "1.25rem",
              color: COLORS.textMuted,
              margin: "0 auto 32px",
              maxWidth: "600px",
              lineHeight: 1.6,
            }}
          >
            Choose from our suite of specialized AI agents. Start free with
            Genesis, or upgrade to unlock advanced capabilities.
          </p>

          {/* Current Tier Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 24px",
              backgroundColor: COLORS.surface,
              borderRadius: "10px",
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span style={{ color: COLORS.textMuted }}>Current Plan:</span>
            <span
              style={{
                fontWeight: 600,
                color: COLORS.success,
                textTransform: "capitalize",
              }}
            >
              {CURRENT_USER_TIER}
            </span>
            <Link
              href="/pricing"
              style={{
                padding: "6px 12px",
                backgroundColor: `${COLORS.success}15`,
                color: COLORS.success,
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                marginLeft: "8px",
              }}
            >
              Upgrade →
            </Link>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "24px",
          }}
        >
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentTier={CURRENT_USER_TIER}
            />
          ))}
        </div>
      </div>

      {/* Pricing Tiers Section */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          padding: "64px 24px",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                margin: "0 0 16px",
              }}
            >
              Choose Your Plan
            </h2>
            <p
              style={{
                fontSize: "1.125rem",
                color: COLORS.textMuted,
                margin: 0,
              }}
            >
              All plans include Genesis Agent. Upgrade to unlock more agents and
              features.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "24px",
            }}
          >
            {PRICING_TIERS.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                isCurrentTier={tier.id === CURRENT_USER_TIER}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AGENT CARD COMPONENT
// ============================================================================

interface AgentCardProps {
  agent: Agent;
  currentTier: TierLevel;
}

function AgentCard({ agent, currentTier }: AgentCardProps) {
  const isIncluded = isAgentIncludedInTier(agent.id, currentTier);
  const standalonePrice = agent.pricing.monthly;
  const requiredTier = agent.pricing.includedIn[0];

  return (
    <Link
      href={`/agent/${agent.id}`}
      style={{
        display: "block",
        backgroundColor: COLORS.surface,
        borderRadius: "16px",
        border: `1px solid ${isIncluded ? agent.color : COLORS.border}`,
        padding: "24px",
        textDecoration: "none",
        color: "inherit",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow effect for included agents */}
      {isIncluded && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            backgroundColor: `${agent.color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            border: `1px solid ${agent.color}30`,
          }}
        >
          {agent.icon}
        </div>

        {/* Pricing Badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
          }}
        >
          <span
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 600,
              backgroundColor: standalonePrice === 0 ? `${COLORS.success}15` : `${agent.color}15`,
              color: standalonePrice === 0 ? COLORS.success : agent.color,
              border: `1px solid ${standalonePrice === 0 ? COLORS.success : agent.color}30`,
            }}
          >
            {formatPrice(standalonePrice)}
          </span>

          {isIncluded ? (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: `${COLORS.success}15`,
                color: COLORS.success,
              }}
            >
              ✓ Active
            </span>
          ) : (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: COLORS.surfaceLight,
                color: COLORS.textMuted,
              }}
            >
              {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}+
            </span>
          )}
        </div>
      </div>

      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          margin: "0 0 8px",
        }}
      >
        {agent.name}
      </h3>

      <p
        style={{
          fontSize: "14px",
          color: COLORS.textMuted,
          margin: "0 0 16px",
          lineHeight: 1.5,
        }}
      >
        {agent.description}
      </p>

      {/* Features Preview */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {agent.features.slice(0, 3).map((feature, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: COLORS.textMuted,
            }}
          >
            <span style={{ color: isIncluded ? COLORS.success : agent.color }}>
              •
            </span>
            <span>{feature}</span>
          </div>
        ))}
        {agent.features.length > 3 && (
          <div
            style={{
              fontSize: "13px",
              color: COLORS.textMuted,
              paddingLeft: "16px",
            }}
          >
            +{agent.features.length - 3} more features
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "20px",
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: isIncluded ? COLORS.success : COLORS.text,
            }}
          >
            {isIncluded ? "Activated" : "Learn More →"}
          </span>

          {!isIncluded && standalonePrice > 0 && (
            <span
              style={{
                fontSize: "12px",
                color: COLORS.textMuted,
              }}
            >
              or upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// TIER CARD COMPONENT
// ============================================================================

interface TierCardProps {
  tier: (typeof PRICING_TIERS)[0];
  isCurrentTier: boolean;
}

function TierCard({ tier, isCurrentTier }: TierCardProps) {
  const savings = calculateSavings(tier);
  const includedAgentsValue = tier.includedAgents.reduce(
    (total, id) => total + (id === "genesis" ? 0 : id === "support" ? 10 : id === "monitor" ? 8 : id === "trading" ? 15 : 0),
    0
  );

  return (
    <div
      style={{
        backgroundColor: isCurrentTier ? `${COLORS.success}05` : COLORS.background,
        borderRadius: "16px",
        border: `2px solid ${isCurrentTier ? COLORS.success : COLORS.border}`,
        padding: "24px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Current Plan Badge */}
      {isCurrentTier && (
        <div
          style={{
            position: "absolute",
            top: "-12px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 16px",
            backgroundColor: COLORS.success,
            color: COLORS.background,
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          CURRENT PLAN
        </div>
      )}

      {/* Popular Badge */}
      {tier.highlighted && !isCurrentTier && (
        <div
          style={{
            position: "absolute",
            top: "-12px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 16px",
            backgroundColor: COLORS.info,
            color: COLORS.text,
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          POPULAR
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: "0 0 8px",
          }}
        >
          {tier.name}
        </h3>
        <p
          style={{
            fontSize: "14px",
            color: COLORS.textMuted,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {tier.description}
        </p>
      </div>

      {/* Price */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
            }}
          >
            ${tier.monthlyPrice}
          </span>
          <span style={{ color: COLORS.textMuted }}>/mo</span>
        </div>
        {tier.monthlyPrice > 0 && (
          <div
            style={{
              fontSize: "14px",
              color: COLORS.textMuted,
            }}
          >
            ${tier.annualPrice}/year (save 2 months)
          </div>
        )}
        {includedAgentsValue > 0 && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 12px",
              backgroundColor: `${COLORS.success}10`,
              borderRadius: "8px",
              fontSize: "13px",
              color: COLORS.success,
            }}
          >
            Includes ${includedAgentsValue}/mo value
          </div>
        )}
      </div>

      {/* Included Agents */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "12px",
          }}
        >
          Included Agents
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {tier.includedAgents.map((agentId) => {
            const agent = AGENTS[agentId];
            return (
              <div
                key={agentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  backgroundColor: `${agent.color}10`,
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              >
                <span>{agent.icon}</span>
                <span style={{ flex: 1 }}>{agent.name}</span>
                <span
                  style={{
                    fontSize: "12px",
                    color: COLORS.textMuted,
                    textDecoration: "line-through",
                  }}
                >
                  {agent.pricing.monthly > 0 && `$${agent.pricing.monthly}`}
                </span>
                <span style={{ color: COLORS.success, fontSize: "12px" }}>✓</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features */}
      <div style={{ flex: 1, marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "12px",
          }}
        >
          Features
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {tier.features.slice(0, 6).map((feature, index) => (
            <li
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: COLORS.textMuted,
              }}
            >
              <span style={{ color: COLORS.success }}>✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <Link
        href={`/pricing?plan=${tier.id}`}
        style={{
          display: "block",
          width: "100%",
          padding: "14px 24px",
          backgroundColor: isCurrentTier
            ? COLORS.success
            : tier.highlighted
            ? COLORS.info
            : "transparent",
          color: isCurrentTier || tier.highlighted ? COLORS.background : COLORS.text,
          border: `2px solid ${
            isCurrentTier ? COLORS.success : tier.highlighted ? COLORS.info : COLORS.border
          }`,
          borderRadius: "10px",
          fontSize: "16px",
          fontWeight: 600,
          textAlign: "center",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        {isCurrentTier ? "Current Plan" : tier.monthlyPrice === 0 ? "Get Started" : "Upgrade"}
      </Link>
    </div>
  );
}
