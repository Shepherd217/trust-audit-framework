import { useState, useCallback, useRef, useEffect, RefObject } from 'react';

interface TiltState {
  tiltX: number;
  tiltY: number;
  glareX: number;
  glareY: number;
  glareOpacity: number;
  isHovering: boolean;
}

interface UseTiltOptions {
  maxTilt?: number;
  scale?: number;
  glareEnabled?: boolean;
  glareMaxOpacity?: number;
  perspective?: number;
  transitionDuration?: number;
  floatEnabled?: boolean;
  floatAmplitude?: number;
  floatSpeed?: number;
}

interface UseTiltReturn {
  ref: RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
  glareStyle: React.CSSProperties;
  isHovering: boolean;
  tiltState: TiltState;
}

const DEFAULT_OPTIONS: Required<UseTiltOptions> = {
  maxTilt: 15,
  scale: 1.02,
  glareEnabled: true,
  glareMaxOpacity: 0.15,
  perspective: 1000,
  transitionDuration: 400,
  floatEnabled: true,
  floatAmplitude: 8,
  floatSpeed: 3000,
};

export function useTilt(options: UseTiltOptions = {}): UseTiltReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 });
  const currentRef = useRef({ tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 });
  const floatRef = useRef({ angle: 0, active: true });

  const [tiltState, setTiltState] = useState<TiltState>({
    tiltX: 0,
    tiltY: 0,
    glareX: 50,
    glareY: 50,
    glareOpacity: 0,
    isHovering: false,
  });

  // Smooth animation loop using requestAnimationFrame
  const animate = useCallback(() => {
    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const smoothFactor = 0.12; // Lower = smoother/slower

    currentRef.current.tiltX = lerp(currentRef.current.tiltX, targetRef.current.tiltX, smoothFactor);
    currentRef.current.tiltY = lerp(currentRef.current.tiltY, targetRef.current.tiltY, smoothFactor);
    currentRef.current.glareX = lerp(currentRef.current.glareX, targetRef.current.glareX, smoothFactor);
    currentRef.current.glareY = lerp(currentRef.current.glareY, targetRef.current.glareY, smoothFactor);

    // Apply floating animation when idle
    let floatX = 0;
    let floatY = 0;
    
    if (opts.floatEnabled && floatRef.current.active && !tiltState.isHovering) {
      floatRef.current.angle += (2 * Math.PI) / (opts.floatSpeed / 16); // ~60fps
      floatX = Math.sin(floatRef.current.angle) * (opts.floatAmplitude / 2);
      floatY = Math.cos(floatRef.current.angle * 0.7) * (opts.floatAmplitude / 2);
    }

    setTiltState(prev => ({
      ...prev,
      tiltX: currentRef.current.tiltX + floatX,
      tiltY: currentRef.current.tiltY + floatY,
      glareX: currentRef.current.glareX,
      glareY: currentRef.current.glareY,
    }));

    frameRef.current = requestAnimationFrame(animate);
  }, [opts.floatEnabled, opts.floatAmplitude, opts.floatSpeed, tiltState.isHovering]);

  // Start animation loop
  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [animate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate mouse position relative to center (-1 to 1)
    const mouseX = (e.clientX - centerX) / (rect.width / 2);
    const mouseY = (e.clientY - centerY) / (rect.height / 2);

    // Calculate tilt angles (inverted for natural feel)
    const tiltY = mouseX * opts.maxTilt; // Rotate around Y-axis based on X position
    const tiltX = -mouseY * opts.maxTilt; // Rotate around X-axis based on Y position

    // Calculate glare position (opposite to tilt)
    const glareX = 50 + mouseX * 50;
    const glareY = 50 + mouseY * 50;

    targetRef.current = { tiltX, tiltY, glareX, glareY };
    floatRef.current.active = false;

    setTiltState(prev => ({
      ...prev,
      isHovering: true,
      glareOpacity: opts.glareEnabled ? opts.glareMaxOpacity : 0,
    }));
  }, [opts.maxTilt, opts.glareEnabled, opts.glareMaxOpacity]);

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { tiltX: 0, tiltY: 0, glareX: 50, glareY: 50 };
    floatRef.current.active = true;

    setTiltState(prev => ({
      ...prev,
      isHovering: false,
      glareOpacity: 0,
    }));
  }, []);

  const handleMouseEnter = useCallback(() => {
    floatRef.current.active = false;
    setTiltState(prev => ({ ...prev, isHovering: true }));
  }, []);

  // Attach event listeners
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('mousemove', handleMouseMove as unknown as EventListener);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [handleMouseMove, handleMouseLeave, handleMouseEnter]);

  const style: React.CSSProperties = {
    transform: `
      perspective(${opts.perspective}px)
      rotateX(${tiltState.tiltX}deg)
      rotateY(${tiltState.tiltY}deg)
      scale3d(${tiltState.isHovering ? opts.scale : 1}, ${tiltState.isHovering ? opts.scale : 1}, 1)
    `,
    transformStyle: 'preserve-3d',
    transition: tiltState.isHovering 
      ? 'none' // Smooth animation handles this
      : `transform ${opts.transitionDuration}ms cubic-bezier(0.23, 1, 0.32, 1)`,
    willChange: 'transform',
  };

  const glareStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    background: opts.glareEnabled
      ? `radial-gradient(
          circle at ${tiltState.glareX}% ${tiltState.glareY}%,
          rgba(255, 255, 255, ${tiltState.glareOpacity}) 0%,
          rgba(255, 255, 255, 0) 60%
        )`
      : 'none',
    opacity: tiltState.glareOpacity,
    transition: `opacity ${opts.transitionDuration}ms ease-out`,
    zIndex: 10,
  };

  return {
    ref,
    style,
    glareStyle,
    isHovering: tiltState.isHovering,
    tiltState,
  };
}

export type { UseTiltOptions, TiltState, UseTiltReturn };
