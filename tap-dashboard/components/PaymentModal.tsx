"use client";

import React, { useState, useCallback } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { CreatePaymentIntentResponse } from "../types/payments";

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
};

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string;
  amount: number;
  currency: string;
  taskName: string;
  agentName: string;
  platformFeePercent?: number;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

type PaymentState = "idle" | "processing" | "success" | "error";

const PaymentModalContent: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  clientSecret,
  amount,
  currency,
  taskName,
  agentName,
  platformFeePercent = 5,
  onSuccess,
  onError,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const platformFee = Math.round(amount * (platformFeePercent / 100));
  const totalAmount = amount + platformFee;

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      setPaymentState("processing");
      setErrorMessage("");

      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/payment/complete`,
          },
          redirect: "if_required",
        });

        if (error) {
          setErrorMessage(error.message || "Payment failed");
          setPaymentState("error");
          onError?.(error.message || "Payment failed");
        } else if (paymentIntent) {
          if (paymentIntent.status === "succeeded") {
            setPaymentState("success");
            onSuccess?.(paymentIntent.id);
          } else if (paymentIntent.status === "requires_action") {
            // 3D Secure or other additional authentication required
            const { error: confirmError } = await stripe.confirmCardPayment(
              clientSecret
            );
            if (confirmError) {
              setErrorMessage(confirmError.message || "Authentication failed");
              setPaymentState("error");
              onError?.(confirmError.message || "Authentication failed");
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Payment failed";
        setErrorMessage(message);
        setPaymentState("error");
        onError?.(message);
      }
    },
    [stripe, elements, clientSecret, onSuccess, onError]
  );

  const handleClose = () => {
    if (paymentState !== "processing") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(2, 2, 4, 0.9)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: "16px",
          border: `1px solid ${COLORS.border}`,
          maxWidth: "480px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: `0 0 40px rgba(0, 255, 159, 0.1)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 600,
                color: COLORS.text,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              Complete Payment
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "14px",
                color: COLORS.textMuted,
              }}
            >
              Pay {agentName} for {taskName}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={paymentState === "processing"}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              cursor: paymentState === "processing" ? "not-allowed" : "pointer",
              fontSize: "24px",
              padding: "4px",
              lineHeight: 1,
              opacity: paymentState === "processing" ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Amount Breakdown */}
        <div
          style={{
            padding: "24px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              backgroundColor: COLORS.background,
              borderRadius: "12px",
              padding: "16px",
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span style={{ color: COLORS.textMuted, fontSize: "14px" }}>
                Task Amount
              </span>
              <span style={{ color: COLORS.text, fontSize: "14px" }}>
                {formatAmount(amount)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span style={{ color: COLORS.textMuted, fontSize: "14px" }}>
                Platform Fee ({platformFeePercent}%)
              </span>
              <span style={{ color: COLORS.text, fontSize: "14px" }}>
                {formatAmount(platformFee)}
              </span>
            </div>
            <div
              style={{
                borderTop: `1px solid ${COLORS.border}`,
                paddingTop: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: COLORS.text,
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                Total
              </span>
              <span
                style={{
                  color: COLORS.primary,
                  fontSize: "24px",
                  fontWeight: 700,
                }}
              >
                {formatAmount(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        {paymentState === "success" ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: `${COLORS.success}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                border: `2px solid ${COLORS.success}`,
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke={COLORS.success}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: "20px",
                fontWeight: 600,
                color: COLORS.text,
              }}
            >
              Payment Successful!
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: COLORS.textMuted,
              }}
            >
              Funds are held in escrow until task completion.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: "24px",
                padding: "12px 32px",
                backgroundColor: COLORS.primary,
                color: COLORS.background,
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.opacity = "0.9")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = "1")
              }
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
            {/* Stripe Payment Element */}
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: COLORS.background,
                borderRadius: "12px",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <PaymentElement
                options={{
                  layout: {
                    type: "tabs",
                    defaultCollapsed: false,
                  },
                  defaultValues: {
                    billingDetails: {
                      name: "",
                    },
                  },
                }}
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: `${COLORS.error}15`,
                  border: `1px solid ${COLORS.error}40`,
                  borderRadius: "8px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ color: COLORS.error, fontSize: "14px" }}>
                  {errorMessage}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!stripe || paymentState === "processing"}
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: COLORS.primary,
                color: COLORS.background,
                border: "none",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 600,
                cursor:
                  !stripe || paymentState === "processing"
                    ? "not-allowed"
                    : "pointer",
                opacity: !stripe || paymentState === "processing" ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s",
              }}
            >
              {paymentState === "processing" ? (
                <>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      animation: "spin 1s linear infinite",
                    }}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      strokeOpacity="0.25"
                    />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Processing...
                </>
              ) : (
                `Pay ${formatAmount(totalAmount)}`
              )}
            </button>

            <style jsx>{`
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>

            {/* Security Note */}
            <div
              style={{
                marginTop: "16px",
                textAlign: "center",
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span
                style={{
                  fontSize: "12px",
                  color: COLORS.textMuted,
                }}
              >
                Secured by Stripe encryption
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Wrapper component with Stripe Elements provider
export const PaymentModal: React.FC<PaymentModalProps> = (props) => {
  if (!props.isOpen) return null;

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: COLORS.primary,
        colorBackground: COLORS.background,
        colorText: COLORS.text,
        colorDanger: COLORS.error,
        borderRadius: "8px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
      rules: {
        ".Input": {
          backgroundColor: COLORS.surfaceLight,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.text,
        },
        ".Input:focus": {
          borderColor: COLORS.primary,
          boxShadow: `0 0 0 1px ${COLORS.primary}`,
        },
        ".Tab": {
          backgroundColor: COLORS.surfaceLight,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.textMuted,
        },
        ".Tab--selected": {
          backgroundColor: `${COLORS.primary}15`,
          borderColor: COLORS.primary,
          color: COLORS.primary,
        },
        ".Label": {
          color: COLORS.textMuted,
        },
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentModalContent {...props} />
    </Elements>
  );
};

export default PaymentModal;
