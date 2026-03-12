"use client";

/**
 * MoltOS Pricing Page
 * 
 * World-class pricing page featuring:
 * - Four tiers: Starter (FREE), Builder ($29/mo), Pro ($79/mo), Enterprise ($199/mo)
 * - Visual comparison table showing features per tier
 * - Magnetic CTA buttons for each tier
 * - Particle background with subtle gradient effects
 * - FAQ section at bottom
 * - "Most Popular" badge on Pro tier
 */

import { useState, useEffect, useRef } from "react";
import { MagneticButton } from "@/components/MagneticButton";
import { TiltCard, MoltOSCard } from "@/components/TiltCard";
import { motion, AnimatePresence } from "framer-motion";
import { FadeInSection } from "@/components/FadeInSection";
import { ScrollProgress } from "@/components/ScrollProgress";

// MoltOS Brand Colors
const COLORS = {
  primary: "#00FF9F",
  primaryGlow: "rgba(0, 255, 159, 0.4)",
  primaryGlowStrong: "rgba(0, 255, 159, 0.6)",
  background: "#020204",
  surface: "#0A0A0F",
  surfaceLight: "#12121A",
  border: "#1E1E2E",
  text: "#FFFFFF",
  textMuted: "#888899",
};

// Pricing tiers data
const tiers = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    priceLabel: "FREE",
    period: "forever",
    description: "Perfect for exploring MoltOS capabilities",
    features: [
      { text: "1 Agent", included: true },
      { text: "1,000 API calls/month", included: true },
      { text: "Basic memory storage", included: true },
      { text: "Community support", included: true },
      { text: "5 Tools", included: true },
      { text: "Advanced analytics", included: false },
      { text: "Custom integrations", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Get Started Free",
    variant: "ghost" as const,
    popular: false,
  },
  {
    id: "builder",
    name: "Builder",
    price: 29,
    priceLabel: "$29",
    period: "/month",
    description: "For solo developers and small projects",
    features: [
      { text: "5 Agents", included: true },
      { text: "50,000 API calls/month", included: true },
      { text: "Persistent memory", included: true },
      { text: "Email support", included: true },
      { text: "25 Tools", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Custom integrations", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Start Building",
    variant: "secondary" as const,
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    priceLabel: "$79",
    period: "/month",
    description: "For professional developers and teams",
    features: [
      { text: "Unlimited Agents", included: true },
      { text: "500,000 API calls/month", included: true },
      { text: "Advanced memory with RAG", included: true },
      { text: "Priority support", included: true },
      { text: "100+ Tools", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Custom integrations", included: true },
      { text: "Team collaboration", included: true },
    ],
    cta: "Go Pro",
    variant: "primary" as const,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    priceLabel: "$199",
    period: "/month",
    description: "For organizations with advanced needs",
    features: [
      { text: "Unlimited everything", included: true },
      { text: "Unlimited API calls", included: true },
      { text: "Enterprise memory cluster", included: true },
      { text: "24/7 dedicated support", included: true },
      { text: "Custom tool development", included: true },
      { text: "Advanced analytics & reporting", included: true },
      { text: "White-label options", included: true },
      { text: "SLA guarantee", included: true },
    ],
    cta: "Contact Sales",
    variant: "secondary" as const,
    popular: false,
  },
];

// Comparison table features
const comparisonFeatures = [
  { category: "Agents", starter: "1", builder: "5", pro: "Unlimited", enterprise: "Unlimited" },
  { category: "API Calls", starter: "1,000/mo", builder: "50,000/mo", pro: "500,000/mo", enterprise: "Unlimited" },
  { category: "Memory", starter: "Basic", builder: "Persistent", pro: "Advanced RAG", enterprise: "Enterprise Cluster" },
  { category: "Tools", starter: "5", builder: "25", pro: "100+", enterprise: "Custom" },
  { category: "Support", starter: "Community", builder: "Email", pro: "Priority", enterprise: "24/7 Dedicated" },
  { category: "Analytics", starter: "—", builder: "Basic", pro: "Advanced", enterprise: "Enterprise" },
  { category: "Team Members", starter: "1", builder: "3", pro: "10", enterprise: "Unlimited" },
  { category: "Custom Integrations", starter: "—", builder: "—", pro: "✓", enterprise: "✓" },
  { category: "SLA", starter: "—", builder: "—", pro: "99.9%", enterprise: "99.99%" },
  { category: "White-label", starter: "—", builder: "—", pro: "—", enterprise: "✓" },
];

// FAQ data
const faqs = [
  {
    question: "What is an Agent in MoltOS?",
    answer: "An Agent in MoltOS is an autonomous AI entity that can perceive its environment, make decisions, and take actions. Think of it as your intelligent digital assistant that can be customized for specific tasks.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll have immediate access to new features. When downgrading, changes take effect at the start of your next billing cycle.",
  },
  {
    question: "What happens if I exceed my API call limit?",
    answer: "We'll notify you when you reach 80% of your limit. If you exceed it, your agents will continue to work but with reduced priority. You can upgrade anytime or purchase additional API call packs.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer: "Yes! Every paid plan comes with a 14-day free trial. No credit card required to start. You can explore all features risk-free before committing.",
  },
  {
    question: "What's included in Enterprise support?",
    answer: "Enterprise customers get a dedicated account manager, 24/7 priority support via phone/email/chat, guaranteed response times, and direct access to our engineering team for critical issues.",
  },
  {
    question: "Can I self-host MoltOS?",
    answer: "Enterprise customers have the option to deploy MoltOS on their own infrastructure with our Bring Your Own Cloud (BYOC) offering. Contact sales for details.",
  },
];

// Particle Background Component
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particles.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 159, ${particle.opacity * 0.3})`;
        ctx.fill();

        // Draw connections
        particles.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(0, 255, 159, ${(1 - dist / 150) * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    draw();

    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

// Check icon component
function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

// X icon component
function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// Pricing Card Component
function PricingCard({ tier, index }: { tier: typeof tiers[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="relative"
    >
      {/* Popular badge */}
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div
            className="px-4 py-1 rounded-full text-sm font-semibold"
            style={{
              background: COLORS.primary,
              color: COLORS.background,
              boxShadow: `0 0 20px ${COLORS.primaryGlow}`,
            }}
          >
            Most Popular
          </div>
        </div>
      )}

      <TiltCard
        maxTilt={8}
        scale={1.02}
        glareEnabled={true}
        glareMaxOpacity={0.1}
        className={`h-full rounded-2xl overflow-hidden ${
          tier.popular
            ? "border-2"
            : "border"
        }`}
        style={{
          background: tier.popular
            ? `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`
            : COLORS.surface,
          borderColor: tier.popular ? COLORS.primary : COLORS.border,
          boxShadow: tier.popular
            ? `0 0 40px ${COLORS.primaryGlow}, inset 0 1px 0 0 rgba(255,255,255,0.1)`
            : `inset 0 1px 0 0 rgba(255,255,255,0.05)`,
        }}
      >
        <div className="p-6 md:p-8 h-full flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <h3
              className="text-xl font-bold mb-2"
              style={{ color: COLORS.text }}
            >
              {tier.name}
            </h3>
            <p
              className="text-sm"
              style={{ color: COLORS.textMuted }}
            >
              {tier.description}
            </p>
          </div>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span
                className="text-4xl md:text-5xl font-bold"
                style={{ color: tier.popular ? COLORS.primary : COLORS.text }}
              >
                {tier.priceLabel}
              </span>
              {tier.period !== "forever" && (
                <span
                  className="text-lg"
                  style={{ color: COLORS.textMuted }}
                >
                  {tier.period}
                </span>
              )}
            </div>
            {tier.period === "forever" && (
              <span
                className="text-sm"
                style={{ color: COLORS.textMuted }}
              >
                No credit card required
              </span>
            )}
          </div>

          {/* CTA Button */}
          <div className="mb-8">
            <MagneticButton
              variant={tier.variant}
              size="lg"
              className="w-full"
              glowOnHover={tier.popular}
            >
              {tier.cta}
            </MagneticButton>
          </div>

          {/* Features */}
          <div className="flex-1">
            <p
              className="text-sm font-semibold mb-4 uppercase tracking-wider"
              style={{ color: COLORS.textMuted }}
            >
              Features
            </p>
            <ul className="space-y-3">
              {tier.features.map((feature, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3"
                >
                  {feature.included ? (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: `${COLORS.primary}20`,
                      }}
                    >
                      <CheckIcon
                        className="w-3 h-3"
                        style={{ color: COLORS.primary }}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: `${COLORS.textMuted}10`,
                      }}
                    >
                      <XIcon
                        className="w-3 h-3"
                        style={{ color: COLORS.textMuted }}
                      />
                    </div>
                  )}
                  <span
                    className="text-sm"
                    style={{
                      color: feature.included ? COLORS.text : COLORS.textMuted,
                    }}
                  >
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Glow effect for popular tier */}
        {tier.popular && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at top, ${COLORS.primaryGlow} 0%, transparent 70%)`,
              opacity: 0.3,
            }}
          />
        )}
      </TiltCard>
    </motion.div>
  );
}

// Comparison Table Component
function ComparisonTable() {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  return (
    <FadeInSection direction="up" className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th
                className="text-left py-4 px-6 font-semibold"
                style={{ color: COLORS.textMuted }}
              >
                Features
              </th>
              {["Starter", "Builder", "Pro", "Enterprise"].map((name, i) => (
                <th
                  key={name}
                  className="text-center py-4 px-6 font-bold text-lg"
                  style={{
                    color: name === "Pro" ? COLORS.primary : COLORS.text,
                    background:
                      hoveredCol === i
                        ? `${COLORS.surfaceLight}`
                        : name === "Pro"
                        ? `${COLORS.primary}05`
                        : "transparent",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={() => setHoveredCol(i)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  {name}
                  {name === "Pro" && (
                    <span
                      className="block text-xs font-normal mt-1"
                      style={{ color: COLORS.primary }}
                    >
                      Most Popular
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonFeatures.map((feature, idx) => (
              <tr
                key={feature.category}
                style={{
                  background:
                    idx % 2 === 0 ? "transparent" : `${COLORS.surface}50`,
                }}
              >
                <td
                  className="py-4 px-6 font-medium"
                  style={{ color: COLORS.text }}
                >
                  {feature.category}
                </td>
                {[
                  feature.starter,
                  feature.builder,
                  feature.pro,
                  feature.enterprise,
                ].map((value, i) => (
                  <td
                    key={i}
                    className="text-center py-4 px-6"
                    style={{
                      background:
                        hoveredCol === i
                          ? `${COLORS.surfaceLight}80`
                          : i === 2
                          ? `${COLORS.primary}03`
                          : "transparent",
                      transition: "background 0.2s ease",
                      color:
                        value === "✓"
                          ? COLORS.primary
                          : value === "—"
                          ? COLORS.textMuted
                          : COLORS.text,
                    }}
                    onMouseEnter={() => setHoveredCol(i)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    {value === "✓" ? (
                      <CheckIcon
                        className="w-5 h-5 mx-auto"
                        style={{ color: COLORS.primary }}
                      />
                    ) : value === "—" ? (
                      <span style={{ color: COLORS.textMuted }}>—</span>
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FadeInSection>
  );
}

// FAQ Item Component
function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      viewport={{ once: true }}
      className="border-b"
      style={{ borderColor: COLORS.border }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span
          className="text-lg font-semibold pr-4"
          style={{ color: COLORS.text }}
        >
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: isOpen ? COLORS.primary : `${COLORS.textMuted}20`,
            color: isOpen ? COLORS.background : COLORS.textMuted,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M6 2v8M2 6h8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p
              className="pb-6 pr-8"
              style={{ color: COLORS.textMuted, lineHeight: 1.7 }}
            >
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Main Pricing Page
export default function PricingPage() {
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: COLORS.background }}
    >
      <ScrollProgress />

      {/* Particle Background */}
      <ParticleBackground />

      {/* Gradient Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px]"
          style={{ background: `${COLORS.primary}15` }}
        />
        <div
          className="absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: `${COLORS.primary}10` }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <FadeInSection direction="up" className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <span
              className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{
                background: `${COLORS.primary}15`,
                color: COLORS.primary,
                border: `1px solid ${COLORS.primary}30`,
              }}
            >
              Simple, transparent pricing
            </span>
          </motion.div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6"
            style={{ color: COLORS.text }}
          >
            Choose your{" "}
            <span style={{ color: COLORS.primary }}>MoltOS</span> plan
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto"
            style={{ color: COLORS.textMuted }}
          >
            Start free and scale as you grow. All plans include core MoltOS
            primitives with varying limits and features.
          </p>
        </FadeInSection>
      </section>

      {/* Pricing Cards */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
            {tiers.map((tier, index) => (
              <PricingCard key={tier.id} tier={tier} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-5xl mx-auto">
          <FadeInSection direction="up" className="text-center mb-16">
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: COLORS.text }}
            >
              Compare all features
            </h2>
            <p
              className="text-lg"
              style={{ color: COLORS.textMuted }}
            >
              Detailed breakdown of what's included in each plan
            </p>
          </FadeInSection>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              background: COLORS.surface,
              borderColor: COLORS.border,
            }}
          >
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-3xl mx-auto">
          <FadeInSection direction="up" className="text-center mb-16">
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: COLORS.text }}
            >
              Frequently asked questions
            </h2>
            <p
              className="text-lg"
              style={{ color: COLORS.textMuted }}
            >
              Everything you need to know about MoltOS pricing
            </p>
          </FadeInSection>

          <div className="space-y-0">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-24">
        <FadeInSection direction="up">
          <div
            className="max-w-4xl mx-auto rounded-3xl p-8 md:p-16 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceLight} 100%)`,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {/* Background glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none"
              style={{ background: `${COLORS.primary}20` }}
            />

            <div className="relative z-10">
              <h2
                className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
                style={{ color: COLORS.text }}
              >
                Ready to start building?
              </h2>
              <p
                className="text-lg md:text-xl mb-10 max-w-xl mx-auto"
                style={{ color: COLORS.textMuted }}
              >
                Join thousands of developers building the future with MoltOS.
                Start free, upgrade when you're ready.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <MagneticButton
                  variant="primary"
                  size="lg"
                  showArrow
                >
                  Get Started Free
                </MagneticButton>
                <MagneticButton
                  variant="secondary"
                  size="lg"
                >
                  Contact Sales
                </MagneticButton>
              </div>
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 sm:px-6 lg:px-8 border-t" style={{ borderColor: COLORS.border }}>
        <div className="max-w-7xl mx-auto text-center">
          <p style={{ color: COLORS.textMuted }}>
            MoltOS - The Agent Operating System © 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
