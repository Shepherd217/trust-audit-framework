"use client";

import React from "react";
import { MagneticButton } from "./MagneticButton";
import { RippleContainer } from "./RippleEffect";

// MoltOS Brand Colors
const COLORS = {
  background: "#020204",
  surface: "#0A0A0F",
  surfaceLight: "#12121A",
  border: "#1E1E2E",
  text: "#FFFFFF",
  textMuted: "#888899",
  primary: "#00FF9F",
};

/**
 * MagneticButton Demo - MoltOS Interactive Button System
 * 
 * This component showcases all the features of the MagneticButton
 * and RippleEffect components.
 */

// Icon components for demos
const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SparklesIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export const MagneticButtonDemo: React.FC = () => {
  return (
    <div
      style={{
        padding: "48px",
        backgroundColor: COLORS.background,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 700,
          color: COLORS.text,
          marginBottom: "8px",
        }}
      >
        MoltOS Magnetic Buttons
      </h1>
      <p
        style={{
          fontSize: "16px",
          color: COLORS.textMuted,
          marginBottom: "48px",
        }}
      >
        Delightful micro-interactions that make buttons feel tactile and responsive.
      </p>

      {/* Primary Variants */}
      <Section title="Primary Variants">
        <ButtonRow>
          <MagneticButton variant="primary" size="sm">
            Small Button
          </MagneticButton>
          <MagneticButton variant="primary" size="md">
            Medium Button
          </MagneticButton>
          <MagneticButton variant="primary" size="lg">
            Large Button
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Secondary Variants */}
      <Section title="Secondary Variants">
        <ButtonRow>
          <MagneticButton variant="secondary" size="sm">
            Small
          </MagneticButton>
          <MagneticButton variant="secondary" size="md">
            Medium
          </MagneticButton>
          <MagneticButton variant="secondary" size="lg">
            Large
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Ghost Variants */}
      <Section title="Ghost Variants">
        <ButtonRow>
          <MagneticButton variant="ghost" size="sm">
            Ghost Small
          </MagneticButton>
          <MagneticButton variant="ghost" size="md">
            Ghost Medium
          </MagneticButton>
          <MagneticButton variant="ghost" size="lg">
            Ghost Large
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* With Icons */}
      <Section title="With Icons">
        <ButtonRow>
          <MagneticButton
            variant="primary"
            icon={<DownloadIcon />}
            iconPosition="left"
          >
            Download
          </MagneticButton>
          <MagneticButton
            variant="secondary"
            icon={<SparklesIcon />}
            iconPosition="left"
          >
            Enhance
          </MagneticButton>
          <MagneticButton
            variant="ghost"
            icon={<RefreshIcon />}
            iconPosition="left"
          >
            Refresh
          </MagneticButton>
        </ButtonRow>

        <ButtonRow style={{ marginTop: "16px" }}>
          <MagneticButton
            variant="primary"
            icon={<DownloadIcon />}
            iconPosition="right"
          >
            Download
          </MagneticButton>
          <MagneticButton
            variant="secondary"
            icon={<SparklesIcon />}
            iconPosition="right"
          >
            Enhance
          </MagneticButton>
          <MagneticButton
            variant="ghost"
            icon={<RefreshIcon />}
            iconPosition="right"
          >
            Refresh
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* With Arrows */}
      <Section title="With Arrow Animation">
        <ButtonRow>
          <MagneticButton variant="primary" showArrow>
            Get Started
          </MagneticButton>
          <MagneticButton variant="secondary" showArrow>
            Learn More
          </MagneticButton>
          <MagneticButton variant="ghost" showArrow>
            View Docs
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Disabled State */}
      <Section title="Disabled State">
        <ButtonRow>
          <MagneticButton variant="primary" disabled>
            Disabled Primary
          </MagneticButton>
          <MagneticButton variant="secondary" disabled>
            Disabled Secondary
          </MagneticButton>
          <MagneticButton variant="ghost" disabled>
            Disabled Ghost
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Link Buttons */}
      <Section title="As Links">
        <ButtonRow>
          <MagneticButton href="/install" variant="primary" showArrow>
            Install MoltOS
          </MagneticButton>
          <MagneticButton href="/docs" variant="secondary">
            Documentation
          </MagneticButton>
          <MagneticButton href="/github" variant="ghost">
            GitHub
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Custom Strength */}
      <Section title="Custom Magnetic Strength">
        <ButtonRow>
          <MagneticButton
            variant="primary"
            magneticStrength={0.15}
            size="md"
          >
            Weak (0.15)
          </MagneticButton>
          <MagneticButton
            variant="primary"
            magneticStrength={0.3}
            size="md"
          >
            Normal (0.3)
          </MagneticButton>
          <MagneticButton
            variant="primary"
            magneticStrength={0.5}
            size="md"
          >
            Strong (0.5)
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* With Tailwind Classes */}
      <Section title="With Tailwind Classes">
        <ButtonRow>
          <MagneticButton
            variant="primary"
            className="uppercase tracking-wider font-bold"
          >
            Uppercase Bold
          </MagneticButton>
          <MagneticButton
            variant="secondary"
            className="rounded-full"
          >
            Rounded Full
          </MagneticButton>
          <MagneticButton
            variant="ghost"
            className="border-2"
          >
            Thick Border
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Usage Example */}
      <Section title="Usage Example" description="As requested in requirements">
        <ButtonRow>
          <MagneticButton
            href="/install"
            className="bg-[#00FF9F] text-black px-6 py-3 rounded-lg"
            showArrow
          >
            Get Started
          </MagneticButton>
        </ButtonRow>
      </Section>

      {/* Ripple Container Demo */}
      <Section title="Ripple Container (for non-button elements)">
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <RippleContainer
            className="p-6 rounded-lg"
            style={{
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
            }}
          >
            Click anywhere on this card
          </RippleContainer>

          <RippleContainer
            className="p-6 rounded-lg"
            centered
            style={{
              backgroundColor: COLORS.surfaceLight,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.primary,
            }}
          >
            Centered ripple effect
          </RippleContainer>

          <RippleContainer
            className="p-6 rounded-lg"
            rippleColor="rgba(255, 51, 102, 0.3)"
            style={{
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              color: "#FF3366",
            }}
          >
            Custom ripple color
          </RippleContainer>
        </div>
      </Section>

      {/* Keyboard Accessibility Note */}
      <Section title="Accessibility">
        <div
          style={{
            padding: "24px",
            backgroundColor: COLORS.surface,
            borderRadius: "12px",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <p style={{ color: COLORS.textMuted, margin: 0 }}>
            <strong style={{ color: COLORS.primary }}>✓</strong> All buttons are fully
            keyboard accessible. Try:
          </p>
          <ul
            style={{
              color: COLORS.textMuted,
              marginTop: "12px",
              marginBottom: 0,
              paddingLeft: "20px",
            }}
          >
            <li>Tab to navigate between buttons</li>
            <li>Enter or Space to activate</li>
            <li>Focus ring visible on all variants</li>
            <li>Ripple effect triggers on keyboard activation</li>
          </ul>
        </div>
      </Section>
    </div>
  );
};

// Helper components
const Section: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section style={{ marginBottom: "48px" }}>
    <h2
      style={{
        fontSize: "18px",
        fontWeight: 600,
        color: COLORS.text,
        marginBottom: "4px",
      }}
    >
      {title}
    </h2>
    {description && (
      <p style={{ fontSize: "14px", color: COLORS.textMuted, marginBottom: "16px" }}>
        {description}
      </p>
    )}
    {children}
  </section>
);

const ButtonRow: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      display: "flex",
      gap: "16px",
      flexWrap: "wrap",
      alignItems: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

export default MagneticButtonDemo;
