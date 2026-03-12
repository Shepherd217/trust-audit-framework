"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { RippleEffect, RippleInstance } from "./RippleEffect";

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

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface MagneticButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  magneticStrength?: number;
  springStiffness?: number;
  springDamping?: number;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  showArrow?: boolean;
  glowOnHover?: boolean;
  ariaLabel?: string;
}

interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

// Spring physics simulation
class SpringPhysics {
  private position = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private config: SpringConfig;
  private animationId: number | null = null;
  private onUpdate: (pos: { x: number; y: number }) => void;

  constructor(
    config: SpringConfig,
    onUpdate: (pos: { x: number; y: number }) => void
  ) {
    this.config = config;
    this.onUpdate = onUpdate;
  }

  setTarget(x: number, y: number) {
    this.target = { x, y };
    if (!this.animationId) {
      this.animate();
    }
  }

  reset() {
    this.target = { x: 0, y: 0 };
    if (!this.animationId) {
      this.animate();
    }
  }

  private animate = () => {
    const { stiffness, damping, mass } = this.config;

    // Spring force: F = -k * x
    const forceX = -stiffness * (this.position.x - this.target.x);
    const forceY = -stiffness * (this.position.y - this.target.y);

    // Damping force: F = -c * v
    const dampingX = -damping * this.velocity.x;
    const dampingY = -damping * this.velocity.y;

    // Acceleration: a = F / m
    const accelX = (forceX + dampingX) / mass;
    const accelY = (forceY + dampingY) / mass;

    // Update velocity and position
    this.velocity.x += accelX * 0.016; // 60fps delta
    this.velocity.y += accelY * 0.016;
    this.position.x += this.velocity.x * 0.016;
    this.position.y += this.velocity.y * 0.016;

    this.onUpdate({ ...this.position });

    // Continue animation if not settled
    const isSettled =
      Math.abs(this.position.x - this.target.x) < 0.01 &&
      Math.abs(this.position.y - this.target.y) < 0.01 &&
      Math.abs(this.velocity.x) < 0.01 &&
      Math.abs(this.velocity.y) < 0.01;

    if (!isSettled || this.target.x !== 0 || this.target.y !== 0) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.animationId = null;
      this.position = { x: 0, y: 0 };
      this.velocity = { x: 0, y: 0 };
      this.onUpdate({ x: 0, y: 0 });
    }
  };

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  href,
  onClick,
  disabled = false,
  className = "",
  type = "button",
  magneticStrength = 0.3,
  springStiffness = 150,
  springDamping = 15,
  icon,
  iconPosition = "left",
  showArrow = false,
  glowOnHover = true,
  ariaLabel,
}) => {
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [ripples, setRipples] = useState<RippleInstance[]>([]);
  const springRef = useRef<SpringPhysics | null>(null);

  // Initialize spring physics
  useEffect(() => {
    springRef.current = new SpringPhysics(
      {
        stiffness: springStiffness,
        damping: springDamping,
        mass: 1,
      },
      (pos) => {
        setTransform((prev) => ({ ...prev, x: pos.x, y: pos.y }));
      }
    );

    return () => {
      springRef.current?.destroy();
    };
  }, [springStiffness, springDamping]);

  // Magnetic effect on mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !containerRef.current || !springRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Calculate magnetic pull (stronger when closer to center)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = Math.max(rect.width, rect.height);
      const strength = Math.max(0, 1 - distance / maxDistance) * magneticStrength;

      springRef.current.setTarget(deltaX * strength, deltaY * strength);
    },
    [disabled, magneticStrength]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    springRef.current?.reset();
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
    setTransform((prev) => ({ ...prev, scale: 0.96 }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    setTransform((prev) => ({ ...prev, scale: 1 }));
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Create ripple effect on click
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newRipple: RippleInstance = {
        id: Date.now() + Math.random(),
        x,
        y,
      };

      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);

      onClick?.(e);
    },
    [disabled, onClick]
  );

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsPressed(true);
        setTransform((prev) => ({ ...prev, scale: 0.96 }));

        // Create ripple at center for keyboard activation
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const newRipple: RippleInstance = {
            id: Date.now() + Math.random(),
            x: rect.width / 2,
            y: rect.height / 2,
          };
          setRipples((prev) => [...prev, newRipple]);
          setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
          }, 600);
        }

        onClick?.(e);

        setTimeout(() => {
          setIsPressed(false);
          setTransform((prev) => ({ ...prev, scale: 1 }));
        }, 150);
      }
    },
    [onClick]
  );

  // Variant styles
  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: COLORS.primary,
      color: COLORS.background,
      border: "none",
      boxShadow: isHovered
        ? `0 0 30px ${COLORS.primaryGlowStrong}, 0 4px 14px rgba(0, 255, 159, 0.3)`
        : `0 0 20px ${COLORS.primaryGlow}`,
    },
    secondary: {
      backgroundColor: COLORS.surfaceLight,
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
      boxShadow: isHovered
        ? `0 0 30px rgba(255, 255, 255, 0.1), inset 0 0 20px rgba(255, 255, 255, 0.05)`
        : "none",
    },
    ghost: {
      backgroundColor: isHovered ? `${COLORS.primary}10` : "transparent",
      color: COLORS.primary,
      border: `1px solid ${isHovered ? COLORS.primary : COLORS.border}`,
      boxShadow: isHovered ? `0 0 20px ${COLORS.primaryGlow}` : "none",
    },
  };

  // Size styles
  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: {
      padding: "8px 16px",
      fontSize: "14px",
      borderRadius: "8px",
    },
    md: {
      padding: "12px 24px",
      fontSize: "16px",
      borderRadius: "12px",
    },
    lg: {
      padding: "16px 32px",
      fontSize: "18px",
      borderRadius: "16px",
    },
  };

  // Icon animation styles
  const iconStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
    transform: isHovered
      ? iconPosition === "right"
        ? "translateX(4px)"
        : "translateX(-4px)"
      : "translateX(0)",
  };

  const arrowStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "8px",
    transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
    transform: isHovered ? "translateX(6px)" : "translateX(0)",
  };

  // Focus ring style
  const focusStyle: React.CSSProperties = isFocused
    ? {
        outline: "none",
        boxShadow: `${variantStyles[variant].boxShadow}, 0 0 0 3px ${COLORS.primary}40`,
      }
    : {};

  const baseStyles: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    overflow: "hidden",
    transition: "box-shadow 0.3s ease, background-color 0.2s ease",
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...focusStyle,
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    willChange: "transform",
  };

  // Glow overlay for primary variant
  const glowOverlay = variant === "primary" && glowOnHover && (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: isHovered
          ? `radial-gradient(circle at ${50 + transform.x}% ${50 + transform.y}%, rgba(255,255,255,0.3) 0%, transparent 60%)`
          : "none",
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: "none",
      }}
    />
  );

  const content = (
    <>
      {glowOverlay}
      <RippleEffect ripples={ripples} variant={variant} />
      {icon && iconPosition === "left" && <span style={iconStyle}>{icon}</span>}
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      {icon && iconPosition === "right" && <span style={iconStyle}>{icon}</span>}
      {showArrow && (
        <span style={arrowStyle}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      )}
    </>
  );

  // Magnetic container style
  const containerStyle: React.CSSProperties = {
    display: "inline-block",
    position: "relative",
  };

  if (href && !disabled) {
    return (
      <div
        ref={containerRef}
        style={containerStyle}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        <a
          ref={buttonRef as React.RefObject<HTMLAnchorElement>}
          href={href}
          style={baseStyles}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="link"
          aria-label={ariaLabel}
          aria-disabled={disabled}
        >
          {content}
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      <button
        ref={buttonRef as React.RefObject<HTMLButtonElement>}
        type={type as "button" | "submit" | "reset"}
        disabled={disabled}
        style={baseStyles}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-disabled={disabled}
      >
        {content}
      </button>
    </div>
  );
};

export default MagneticButton;
