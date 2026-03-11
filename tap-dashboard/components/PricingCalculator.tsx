"use client";

import React, { useState, useMemo, useCallback } from "react";

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
  gradientStart: "#00FF9F",
  gradientEnd: "#00D4AA",
};

export type AgentTier = "basic" | "standard" | "premium" | "elite";
export type ComplexityLevel = "simple" | "moderate" | "complex" | "enterprise";
export type UrgencyLevel = "flexible" | "standard" | "urgent" | "critical";

interface PricingCalculatorProps {
  basePrice?: number;
  onPriceChange?: (quote: PriceQuote) => void;
  className?: string;
}

export interface PriceQuote {
  basePrice: number;
  tierMultiplier: number;
  complexityMultiplier: number;
  urgencyMultiplier: number;
  subtotal: number;
  platformFee: number;
  total: number;
  currency: string;
}

const TIER_MULTIPLIERS: Record<AgentTier, { multiplier: number; label: string; description: string }> = {
  basic: { multiplier: 1.0, label: "Basic", description: "Entry-level AI agents" },
  standard: { multiplier: 1.25, label: "Standard", description: "Experienced agents" },
  premium: { multiplier: 1.75, label: "Premium", description: "Expert specialists" },
  elite: { multiplier: 2.5, label: "Elite", description: "Top-tier professionals" },
};

const COMPLEXITY_MULTIPLIERS: Record<ComplexityLevel, { multiplier: number; label: string; description: string }> = {
  simple: { multiplier: 1.0, label: "Simple", description: "Straightforward tasks" },
  moderate: { multiplier: 1.3, label: "Moderate", description: "Requires planning" },
  complex: { multiplier: 1.8, label: "Complex", description: "Multi-step workflows" },
  enterprise: { multiplier: 2.5, label: "Enterprise", description: "Mission-critical" },
};

const URGENCY_MULTIPLIERS: Record<UrgencyLevel, { multiplier: number; label: string; description: string; timeframe: string }> = {
  flexible: { multiplier: 0.9, label: "Flexible", description: "No rush", timeframe: "7+ days" },
  standard: { multiplier: 1.0, label: "Standard", description: "Normal pace", timeframe: "3-5 days" },
  urgent: { multiplier: 1.3, label: "Urgent", description: "Fast delivery", timeframe: "1-2 days" },
  critical: { multiplier: 1.8, label: "Critical", description: "ASAP", timeframe: "< 24 hours" },
};

const PLATFORM_FEE_PERCENT = 5;

const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  basePrice: initialBasePrice = 100,
  onPriceChange,
  className = "",
}) => {
  const [basePrice, setBasePrice] = useState<number>(initialBasePrice);
  const [tier, setTier] = useState<AgentTier>("standard");
  const [complexity, setComplexity] = useState<ComplexityLevel>("moderate");
  const [urgency, setUrgency] = useState<UrgencyLevel>("standard");
  const [currency, setCurrency] = useState<string>("USD");

  const quote = useMemo<PriceQuote>(() => {
    const tierMultiplier = TIER_MULTIPLIERS[tier].multiplier;
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[complexity].multiplier;
    const urgencyMultiplier = URGENCY_MULTIPLIERS[urgency].multiplier;

    const subtotal = basePrice * tierMultiplier * complexityMultiplier * urgencyMultiplier;
    const platformFee = subtotal * (PLATFORM_FEE_PERCENT / 100);
    const total = subtotal + platformFee;

    return {
      basePrice,
      tierMultiplier,
      complexityMultiplier,
      urgencyMultiplier,
      subtotal,
      platformFee,
      total,
      currency,
    };
  }, [basePrice, tier, complexity, urgency, currency]);

  // Notify parent of price changes
  React.useEffect(() => {
    onPriceChange?.(quote);
  }, [quote, onPriceChange]);

  const handleBasePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setBasePrice(value);
    }
  }, []);

  return (
    <div
      className={className}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: "16px",
        border: `1px solid ${COLORS.border}`,
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "480px",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px",
          background: `linear-gradient(135deg, ${COLORS.gradientStart}10, ${COLORS.gradientEnd}05)`,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: "22px",
            fontWeight: 700,
            color: COLORS.text,
          }}
        >
          Price Calculator
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: COLORS.textMuted }}>
          Get an instant quote for your AI task
        </p>
      </div>

      {/* Inputs Section */}
      <div style={{ padding: "24px" }}>
        {/* Base Price Input */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            Base Price
          </label>
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.textMuted,
                  fontSize: "16px",
                }}
              >
                $
              </span>
              <input
                type="number"
                value={basePrice}
                onChange={handleBasePriceChange}
                min={0}
                step={1}
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 32px",
                  backgroundColor: COLORS.background,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "10px",
                  color: COLORS.text,
                  fontSize: "16px",
                  fontWeight: 600,
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = COLORS.primary;
                  e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = COLORS.border;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                padding: "14px 16px",
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "10px",
                color: COLORS.text,
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
            </select>
          </div>
        </div>

        {/* Agent Tier */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            Agent Tier
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "8px",
            }}
          >
            {(Object.keys(TIER_MULTIPLIERS) as AgentTier[]).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  padding: "14px",
                  backgroundColor:
                    tier === t ? `${COLORS.primary}15` : COLORS.background,
                  border: `1px solid ${
                    tier === t ? COLORS.primary : COLORS.border
                  }`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: tier === t ? COLORS.primary : COLORS.text,
                    marginBottom: "2px",
                  }}
                >
                  {TIER_MULTIPLIERS[t].label}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: COLORS.textMuted,
                  }}
                >
                  {TIER_MULTIPLIERS[t].description}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: tier === t ? COLORS.primary : COLORS.textMuted,
                    marginTop: "6px",
                  }}
                >
                  ×{TIER_MULTIPLIERS[t].multiplier}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Complexity */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            Complexity
          </label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {(Object.keys(COMPLEXITY_MULTIPLIERS) as ComplexityLevel[]).map((c) => (
              <button
                key={c}
                onClick={() => setComplexity(c)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  backgroundColor:
                    complexity === c ? `${COLORS.primary}15` : COLORS.background,
                  border: `1px solid ${
                    complexity === c ? COLORS.primary : COLORS.border
                  }`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: complexity === c ? COLORS.primary : COLORS.text,
                    }}
                  >
                    {COMPLEXITY_MULTIPLIERS[c].label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: COLORS.textMuted,
                    }}
                  >
                    {COMPLEXITY_MULTIPLIERS[c].description}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: complexity === c ? COLORS.primary : COLORS.textMuted,
                    padding: "4px 10px",
                    backgroundColor:
                      complexity === c ? `${COLORS.primary}20` : COLORS.surfaceLight,
                    borderRadius: "6px",
                  }}
                >
                  ×{COMPLEXITY_MULTIPLIERS[c].multiplier}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            Urgency
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "8px",
            }}
          >
            {(Object.keys(URGENCY_MULTIPLIERS) as UrgencyLevel[]).map((u) => (
              <button
                key={u}
                onClick={() => setUrgency(u)}
                style={{
                  padding: "14px",
                  backgroundColor:
                    urgency === u ? `${COLORS.primary}15` : COLORS.background,
                  border: `1px solid ${
                    urgency === u ? COLORS.primary : COLORS.border
                  }`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: urgency === u ? COLORS.primary : COLORS.text,
                    marginBottom: "2px",
                  }}
                >
                  {URGENCY_MULTIPLIERS[u].label}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: COLORS.textMuted,
                  }}
                >
                  {URGENCY_MULTIPLIERS[u].timeframe}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: urgency === u ? COLORS.primary : COLORS.textMuted,
                    marginTop: "6px",
                  }}
                >
                  ×{URGENCY_MULTIPLIERS[u].multiplier}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Breakdown */}
      <div
        style={{
          padding: "24px",
          backgroundColor: COLORS.background,
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "14px", color: COLORS.textMuted }}>
            Base Price
          </span>
          <span style={{ fontSize: "14px", color: COLORS.text }}>
            {formatCurrency(basePrice, currency)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "14px", color: COLORS.textMuted }}>
            Multipliers
          </span>
          <span style={{ fontSize: "14px", color: COLORS.text }}>
            ×{quote.tierMultiplier.toFixed(2)} ×{quote.complexityMultiplier.toFixed(1)} ×{quote.urgencyMultiplier.toFixed(1)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "14px", color: COLORS.textMuted }}>
            Subtotal
          </span>
          <span style={{ fontSize: "14px", color: COLORS.text }}>
            {formatCurrency(quote.subtotal, currency)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            paddingBottom: "16px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ fontSize: "14px", color: COLORS.textMuted }}>
            Platform Fee ({PLATFORM_FEE_PERCENT}%)
          </span>
          <span style={{ fontSize: "14px", color: COLORS.text }}>
            {formatCurrency(quote.platformFee, currency)}
          </span>
        </div>

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            Total
          </span>
          <span
            style={{
              fontSize: "32px",
              fontWeight: 700,
              background: `linear-gradient(135deg, ${COLORS.gradientStart}, ${COLORS.gradientEnd})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {formatCurrency(quote.total, currency)}
          </span>
        </div>

        {/* Formula Display */}
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            backgroundColor: COLORS.surfaceLight,
            borderRadius: "8px",
            fontSize: "11px",
            color: COLORS.textMuted,
            fontFamily: "monospace",
            textAlign: "center",
          }}
        >
          {formatCurrency(basePrice, currency)} × {quote.tierMultiplier.toFixed(2)} × {quote.complexityMultiplier.toFixed(1)} × {quote.urgencyMultiplier.toFixed(1)} + {PLATFORM_FEE_PERCENT}% fee
        </div>
      </div>
    </div>
  );
};

export default PricingCalculator;
