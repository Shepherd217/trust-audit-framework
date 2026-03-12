"use client";

import React from "react";

// MoltOS Brand Colors
const COLORS = {
  primary: "#00FF9F",
  primaryGlow: "rgba(0, 255, 159, 0.3)",
  background: "#020204",
  surface: "#0A0A0F",
  surfaceLight: "#12121A",
  border: "#1E1E2E",
  text: "#FFFFFF",
  textMuted: "#888899",
  white: "#FFFFFF",
};

export interface RippleInstance {
  id: number;
  x: number;
  y: number;
}

interface RippleEffectProps {
  ripples: RippleInstance[];
  variant?: "primary" | "secondary" | "ghost";
  color?: string;
  duration?: number;
  maxScale?: number;
}

interface SingleRippleProps {
  x: number;
  y: number;
  color: string;
  duration: number;
  maxScale: number;
  variant: "primary" | "secondary" | "ghost";
}

const SingleRipple: React.FC<SingleRippleProps> = ({
  x,
  y,
  color,
  duration,
  maxScale,
  variant,
}) => {
  // Determine ripple color based on variant
  const getRippleColor = () => {
    switch (variant) {
      case "primary":
        return "rgba(255, 255, 255, 0.3)";
      case "secondary":
        return `${COLORS.primary}30`;
      case "ghost":
        return `${COLORS.primary}20`;
      default:
        return color;
    }
  };

  // Generate unique animation name for this ripple instance
  const animationName = `ripple-${Math.random().toString(36).substr(2, 9)}`;

  // Inject keyframes dynamically
  React.useEffect(() => {
    const styleSheet = document.styleSheets[0];
    const keyframes = `
      @keyframes ${animationName} {
        0% {
          transform: scale(0);
          opacity: 0.8;
        }
        50% {
          opacity: 0.4;
        }
        100% {
          transform: scale(${maxScale});
          opacity: 0;
        }
      }
    `;
    
    // Add to a style element if not exists
    let styleEl = document.getElementById("moltos-ripple-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "moltos-ripple-styles";
      document.head.appendChild(styleEl);
    }
    
    if (!styleEl.textContent?.includes(animationName)) {
      styleEl.textContent += keyframes;
    }
  }, [animationName, maxScale]);

  return (
    <span
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: "4px",
        height: "4px",
        marginLeft: "-2px",
        marginTop: "-2px",
        borderRadius: "50%",
        backgroundColor: getRippleColor(),
        pointerEvents: "none",
        animation: `${animationName} ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
        transformOrigin: "center",
      }}
      data-ripple="true"
    />
  );
};

export const RippleEffect: React.FC<RippleEffectProps> = ({
  ripples,
  variant = "primary",
  color = "rgba(255, 255, 255, 0.3)",
  duration = 600,
  maxScale = 50,
}) => {
  if (ripples.length === 0) return null;

  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: "inherit",
      }}
      aria-hidden="true"
    >
      {ripples.map((ripple) => (
        <SingleRipple
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          color={color}
          duration={duration}
          maxScale={maxScale}
          variant={variant}
        />
      ))}
    </span>
  );
};

// Standalone ripple hook for use in other components
export const useRipple = () => {
  const [ripples, setRipples] = React.useState<RippleInstance[]>([]);

  const createRipple = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, customColor?: string) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const newRipple: RippleInstance = {
        id: Date.now() + Math.random(),
        x,
        y,
      };

      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);

      return newRipple;
    },
    []
  );

  const createCenterRipple = React.useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const newRipple: RippleInstance = {
        id: Date.now() + Math.random(),
        x: rect.width / 2,
        y: rect.height / 2,
      };

      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);

      return newRipple;
    },
    []
  );

  const clearRipples = React.useCallback(() => {
    setRipples([]);
  }, []);

  return {
    ripples,
    createRipple,
    createCenterRipple,
    clearRipples,
    RippleComponent: React.useCallback(
      (props: Omit<RippleEffectProps, "ripples">) => (
        <RippleEffect ripples={ripples} {...props} />
      ),
      [ripples]
    ),
  };
};

// Advanced ripple component with configurable effects
interface AdvancedRippleProps {
  children: React.ReactNode;
  className?: string;
  rippleColor?: string;
  rippleDuration?: number;
  centered?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const RippleContainer: React.FC<AdvancedRippleProps> = ({
  children,
  className = "",
  rippleColor = "rgba(0, 255, 159, 0.3)",
  rippleDuration = 600,
  centered = false,
  disabled = false,
  onClick,
}) => {
  const [ripples, setRipples] = React.useState<RippleInstance[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = centered ? rect.width / 2 : e.clientX - rect.left;
      const y = centered ? rect.height / 2 : e.clientY - rect.top;

      const newRipple: RippleInstance = {
        id: Date.now() + Math.random(),
        x,
        y,
      };

      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, rippleDuration);

      onClick?.(e);
    },
    [centered, disabled, onClick, rippleDuration]
  );

  return (
    <div
      ref={containerRef}
      className={className}
      onClick={handleClick}
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
      <RippleEffect
        ripples={ripples}
        color={rippleColor}
        duration={rippleDuration}
      />
    </div>
  );
};

export default RippleEffect;
