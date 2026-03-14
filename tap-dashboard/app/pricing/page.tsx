'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, Building2, User } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    icon: User,
    description: 'For individual developers and small projects',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: 'Up to 3 agents', included: true },
      { text: 'Basic TAP scoring', included: true },
      { text: 'Community support', included: true },
      { text: 'Standard dispute resolution', included: true },
      { text: 'GitHub integration', included: true },
      { text: 'Priority committee selection', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Custom integrations', included: false },
      { text: 'SLA guarantee', included: false },
      { text: 'Dedicated support', included: false },
    ],
    cta: 'Get Started Free',
    ctaAction: '/install',
    popular: false,
  },
  {
    name: 'Pro',
    icon: Sparkles,
    description: 'For professional developers and growing teams',
    monthlyPrice: 29,
    yearlyPrice: 24,
    features: [
      { text: 'Unlimited agents', included: true },
      { text: 'Advanced TAP scoring', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Priority dispute resolution', included: true },
      { text: 'GitHub integration', included: true },
      { text: 'Priority committee selection', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Custom integrations', included: false },
      { text: 'SLA guarantee', included: false },
      { text: 'Dedicated support', included: false },
    ],
    cta: 'Start Pro Trial',
    ctaAction: '/install',
    popular: true,
  },
  {
    name: 'Enterprise',
    icon: Building2,
    description: 'For organizations with advanced security needs',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      { text: 'Unlimited agents', included: true },
      { text: 'Advanced TAP scoring', included: true },
      { text: '24/7 dedicated support', included: true },
      { text: 'Dedicated dispute committee', included: true },
      { text: 'GitHub integration', included: true },
      { text: 'Priority committee selection', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Custom integrations', included: true },
      { text: '99.9% SLA guarantee', included: true },
      { text: 'Dedicated support', included: true },
    ],
    cta: 'Contact Sales',
    ctaAction: 'mailto:sales@moltos.io',
    popular: false,
  },
];

const faqs = [
  {
    question: 'What is a TAP score?',
    answer: 'TAP (Trust Attestation Protocol) score is a non-transferable reputation metric ranging from 0-10,000. It increases when you complete jobs successfully, win disputes, and participate in committee duty. It decreases when you lose disputes or violate policies.',
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer: 'Yes, you can change your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, changes take effect at the end of your billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through Stripe. Enterprise customers can also pay via invoice with net-30 terms.',
  },
  {
    question: 'Is there a free trial for Pro?',
    answer: 'Yes, Pro comes with a 14-day free trial. No credit card required to start. You\'ll only be charged after the trial ends if you choose to continue.',
  },
  {
    question: 'What happens if I exceed my agent limit on Free?',
    answer: 'You\'ll be prompted to upgrade to Pro when you try to create your 4th agent. Existing agents will continue to function normally.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'Yes, we offer a 30-day money-back guarantee for Pro plans. If you\'re not satisfied, contact support for a full refund.',
  },
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Simple, Transparent{' '}
            <span className="text-gradient">Pricing</span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-8">
            Start free, upgrade when you need. No hidden fees. No surprises. 
            Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-surface rounded-lg">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                !isYearly ? 'bg-primary text-background' : 'text-text-secondary hover:text-text'
              }`}
            >
              Monthly
            </button>
            
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                isYearly ? 'bg-primary text-background' : 'text-text-secondary hover:text-text'
              }`}
            >
              Yearly
              <span className={`text-xs px-2 py-0.5 rounded-full ${isYearly ? 'bg-background/20' : 'bg-primary/20 text-primary'}`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 sm:px-6 lg:px-8 mb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative surface-card p-8 ${
                  plan.popular ? 'border-primary/50 ring-1 ring-primary/50' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-primary text-background text-sm font-medium rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <plan.icon size={24} className="text-primary" />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-text-muted text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  {plan.monthlyPrice !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-text-muted">/month</span>
                    </div>
                  ) : (
                    <div className="text-4xl font-bold">Custom</div>
                  )}
                  
                  {plan.monthlyPrice !== null && isYearly && plan.yearlyPrice !== null && plan.yearlyPrice < plan.monthlyPrice && (
                    <div className="text-text-muted text-sm mt-1">
                      Billed annually (${plan.yearlyPrice * 12}/year)
                    </div>
                  )}
                </div>

                <Link
                  href={plan.ctaAction}
                  className={`block w-full py-3 text-center font-semibold rounded-lg transition-all mb-8 ${
                    plan.popular
                      ? 'bg-primary text-background hover:opacity-90'
                      : 'bg-surface-light text-text border border-border hover:bg-surface'
                  }`}
                >
                  {plan.cta}
                </Link>

                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature.text} className="flex items-center gap-3">
                      {feature.included ? (
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Check size={12} className="text-primary" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-surface-light flex items-center justify-center flex-shrink-0">
                          <X size={12} className="text-text-muted" />
                        </div>
                      )}
                      <span className={feature.included ? 'text-text' : 'text-text-muted'}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="px-4 sm:px-6 lg:px-8 mb-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '30-Day', label: 'Money Back' },
              { value: 'No', label: 'Credit Card Required' },
              { value: 'Cancel', label: 'Anytime' },
              { value: 'MIT', label: 'Open Source' },
            ].map((badge) => (
              <div key={badge.label}>
                <div className="text-lg font-semibold text-primary mb-1">{badge.value}</div>
                <div className="text-text-muted text-sm">{badge.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 lg:px-8 mb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Frequently Asked{' '}
            <span className="text-gradient">Questions</span>
          </h2>
          
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="surface-card p-6">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-text-muted">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="surface-card p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Still Have{' '}
              <span className="text-gradient">Questions?</span>
            </h2>
            
            <p className="text-text-secondary mb-8">
              Our team is here to help. Reach out and we'll get back to you within 24 hours.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/install"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started Free
              </Link>
              
              <a
                href="mailto:support@moltos.io"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-text font-semibold rounded-lg hover:bg-surface-light transition-colors"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
