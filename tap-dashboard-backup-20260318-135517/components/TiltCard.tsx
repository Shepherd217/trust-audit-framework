'use client';

import React, { ReactNode } from 'react';
import { useTilt, UseTiltOptions } from '../hooks/useTilt';

interface TiltCardProps extends UseTiltOptions {
  children: ReactNode;
  className?: string;
  glareClassName?: string;
  innerClassName?: string;
  as?: keyof JSX.IntrinsicElements;
  style?: React.CSSProperties;
}

export function TiltCard({
  children,
  className = '',
  glareClassName = '',
  innerClassName = '',
  style: externalStyle,
  maxTilt = 15,
  scale = 1.02,
  glareEnabled = true,
  glareMaxOpacity = 0.15,
  perspective = 1000,
  transitionDuration = 400,
  floatEnabled = true,
  floatAmplitude = 8,
  floatSpeed = 3000,
  as: Component = 'div',
}: TiltCardProps) {
  const { ref, style, glareStyle, isHovering } = useTilt({
    maxTilt,
    scale,
    glareEnabled,
    glareMaxOpacity,
    perspective,
    transitionDuration,
    floatEnabled,
    floatAmplitude,
    floatSpeed,
  });

  // Custom component rendering
  const Element = Component as React.ElementType;

  return (
    <Element
      ref={ref}
      className={`relative ${className}`}
      style={{
        ...style,
        ...externalStyle,
        // Ensure the element can receive mouse events
        cursor: 'pointer',
      }}
    >
      {/* Inner content wrapper for 3D depth effect */}
      <div
        className={`relative z-0 ${innerClassName}`}
        style={{
          transform: isHovering ? 'translateZ(20px)' : 'translateZ(0)',
          transition: `transform ${transitionDuration}ms cubic-bezier(0.23, 1, 0.32, 1)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>

      {/* Glare overlay */}
      {glareEnabled && (
        <div 
          className={`glare-effect ${glareClassName}`}
          style={glareStyle}
          aria-hidden="true"
        />
      )}

      {/* Subtle border glow on hover */}
      <div
        className="absolute inset-0 rounded-inherit pointer-events-none transition-opacity duration-500"
        style={{
          opacity: isHovering ? 0.5 : 0,
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
          borderRadius: 'inherit',
        }}
        aria-hidden="true"
      />
    </Element>
  );
}

// Pre-styled variants for MoltOS brand
interface MoltOSCardProps extends Omit<TiltCardProps, 'maxTilt' | 'glareEnabled'> {
  variant?: 'default' | 'glow' | 'minimal';
  accentColor?: string;
}

export function MoltOSCard({
  children,
  className = '',
  variant = 'default',
  accentColor = '#6366f1',
  ...props
}: MoltOSCardProps) {
  const baseStyles = 'relative overflow-hidden backdrop-blur-xl';
  
  const variantStyles = {
    default: 'bg-white/5 border border-white/10 rounded-2xl p-6',
    glow: `bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-6`,
    minimal: 'bg-transparent p-4',
  };

  return (
    <TiltCard
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      glareEnabled={variant !== 'minimal'}
      glareMaxOpacity={variant === 'glow' ? 0.25 : 0.15}
      maxTilt={variant === 'minimal' ? 10 : 15}
      floatEnabled={variant !== 'minimal'}
      {...props}
    >
      {/* Glow background for glow variant */}
      {variant === 'glow' && (
        <>
          <div
            className="absolute -inset-px rounded-2xl pointer-events-none opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}20 0%, transparent 50%)`,
            }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)`,
            }}
          />
        </>
      )}
      {children}
    </TiltCard>
  );
}

// Export for convenience
export { useTilt };
export type { TiltCardProps, MoltOSCardProps };
