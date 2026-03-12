"use client";

/**
 * Agent Detail Page
 * /agent/[id] - Shows detailed information about a specific agent
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AgentId,
  AGENTS,
  PRICING_TIERS,
  getAgentById,
  formatPrice,
  isAgentIncludedInTier,
  TierLevel,
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
  purple: "#8B5CF6",
};

// Current user tier - in a real app, this would come from auth/user context
const CURRENT_USER_TIER: TierLevel = "starter";

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as AgentId;
  const agent = getAgentById(agentId);

  if (!agent) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.background,
          color: COLORS.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Agent Not Found</h1>
          <p style={{ color: COLORS.textMuted, marginBottom: "2rem" }}>
            The agent you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/discover"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: COLORS.success,
              color: COLORS.background,
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Browse Agents
          </Link>
        </div>
      </div>
    );
  }

  const isIncluded = isAgentIncludedInTier(agentId, CURRENT_USER_TIER);
  const standalonePrice = agent.pricing.monthly;
  const requiredTier = agent.pricing.includedIn[0];
  const requiredTierInfo = PRICING_TIERS.find((t) => t.id === requiredTier);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.background,
        color: COLORS.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Navigation */}
      <nav
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "16px 24px",
          backgroundColor: COLORS.surface,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <Link
            href="/discover"
            style={{
              color: COLORS.textMuted,
              textDecoration: "none",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            ← Back to Marketplace
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div
        style={{
          background: `linear-gradient(135deg, ${agent.color}10, ${COLORS.surface})`,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "64px 24px",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "32px",
              flexWrap: "wrap",
            }}
          >
            {/* Agent Icon */}
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "24px",
                backgroundColor: `${agent.color}20`,
                border: `2px solid ${agent.color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "60px",
                flexShrink: 0,
              }}
            >
              {agent.icon}
            </div>

            {/* Agent Info */}
            <div style={{ flex: 1, minWidth: "280px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                }}
              >
                <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 700 }}>
                  {agent.name}
                </h1>
                {/* Pricing Badge */}
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    backgroundColor: standalonePrice === 0 ? `${COLORS.success}20` : `${agent.color}20`,
                    color: standalonePrice === 0 ? COLORS.success : agent.color,
                    border: `1px solid ${standalonePrice === 0 ? COLORS.success : agent.color}40`,
                  }}
                >
                  {standalonePrice === 0 ? "FREE" : `$${standalonePrice}/mo`}
                </span>
                {agent.pricing.includedIn.length > 1 && (
                  <span
                    style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 500,
                      backgroundColor: COLORS.surfaceLight,
                      color: COLORS.textMuted,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    or included in {agent.pricing.includedIn.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: "1.25rem",
                  color: COLORS.textMuted,
                  margin: "0 0 24px",
                  maxWidth: "600px",
                  lineHeight: 1.5,
                }}
              >
                {agent.description}
              </p>

              {/* CTA Section */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                {isIncluded ? (
                  <button
                    style={{
                      padding: "14px 32px",
                      backgroundColor: COLORS.success,
                      color: COLORS.background,
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>✓</span> Activate Agent
                  </button>
                ) : (
                  <>
                    <Link
                      href={`/pricing?upgrade=${requiredTier}`}
                      style={{
                        padding: "14px 32px",
                        backgroundColor: agent.color,
                        color: COLORS.background,
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "16px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      Upgrade to Unlock
                    </Link>
                    {standalonePrice > 0 && (
                      <button
                        style={{
                          padding: "14px 32px",
                          backgroundColor: "transparent",
                          color: COLORS.text,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: "10px",
                          fontSize: "16px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Subscribe ${standalonePrice}/mo
                      </button>
                    )}
                  </>
                )}

                {agent.demoAvailable && (
                  <button
                    style={{
                      padding: "14px 32px",
                      backgroundColor: "transparent",
                      color: COLORS.textMuted,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: "10px",
                      fontSize: "16px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Try Demo
                  </button>
                )}
              </div>

              {/* Tier Info */}
              {!isIncluded && requiredTierInfo && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    backgroundColor: `${agent.color}10`,
                    border: `1px solid ${agent.color}30`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: COLORS.textMuted,
                  }}
                >
                  <strong style={{ color: agent.color }}>
                    {requiredTierInfo.name} Plan
                  </strong>{" "}
                  includes this agent for ${requiredTierInfo.monthlyPrice}/mo
                  {standalonePrice > 0 && (
                    <>
                      {" "}
                      — save ${standalonePrice}/mo vs standalone subscription
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "48px",
          }}
        >
          {/* Features Section */}
          <div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: `${COLORS.success}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                }}
              >
                ✓
              </span>
              Features
            </h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {agent.features.map((feature, index) => (
                <li
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    backgroundColor: COLORS.surface,
                    borderRadius: "8px",
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ color: COLORS.success }}>•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Use Cases Section */}
          <div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: `${COLORS.info}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                }}
              >
                💡
              </span>
              Use Cases
            </h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {agent.useCases.map((useCase, index) => (
                <li
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    backgroundColor: COLORS.surface,
                    borderRadius: "8px",
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ color: COLORS.info }}>→</span>
                  <span>{useCase}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Capabilities Section */}
          <div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: `${COLORS.purple}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                }}
              >
                ⚡
              </span>
              Capabilities
            </h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {agent.capabilities.map((capability, index) => (
                <span
                  key={index}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: `${agent.color}15`,
                    color: agent.color,
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: 500,
                    border: `1px solid ${agent.color}30`,
                  }}
                >
                  {capability}
                </span>
              ))}
            </div>

            {/* Pricing Breakdown */}
            <div
              style={{
                marginTop: "32px",
                padding: "24px",
                backgroundColor: COLORS.surface,
                borderRadius: "12px",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  marginBottom: "16px",
                }}
              >
                Pricing Options
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {PRICING_TIERS.map((tier) => {
                  const tierIncludes = isAgentIncludedInTier(agentId, tier.id);
                  return (
                    <div
                      key={tier.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        backgroundColor: tierIncludes
                          ? `${agent.color}10`
                          : COLORS.background,
                        borderRadius: "8px",
                        border: `1px solid ${
                          tierIncludes ? agent.color : COLORS.border
                        }`,
                        opacity: tierIncludes ? 1 : 0.7,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 600,
                            color: tierIncludes ? agent.color : COLORS.text,
                          }}
                        >
                          {tier.name}
                        </span>
                        {tierIncludes && (
                          <span
                            style={{
                              marginLeft: "8px",
                              fontSize: "12px",
                              color: COLORS.success,
                            }}
                          >
                            ✓ Included
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontWeight: 600,
                          color: tierIncludes ? COLORS.success : COLORS.textMuted,
                        }}
                      >
                        {tierIncludes
                          ? formatPrice(0)
                          : formatPrice(agent.pricing.monthly)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Full Description */}
        <div
          style={{
            marginTop: "48px",
            padding: "32px",
            backgroundColor: COLORS.surface,
            borderRadius: "16px",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            About {agent.name}
          </h2>
          <p
            style={{
              fontSize: "1.125rem",
              lineHeight: 1.7,
              color: COLORS.textMuted,
              margin: 0,
            }}
          >
            {agent.longDescription}
          </p>
        </div>
      </div>
    </div>
  );
}
