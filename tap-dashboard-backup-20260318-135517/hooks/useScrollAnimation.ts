"use client";

import { useScroll, useTransform, useSpring, MotionValue } from "framer-motion";
import { useRef, useEffect, useState } from "react";

/**
 * useScrollProgress - Returns normalized scroll progress (0 to 1)
 * Can be used for global page progress or element-specific progress
 */
export function useScrollProgress() {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return smoothProgress;
}

/**
 * useElementScrollProgress - Returns scroll progress for a specific element
 */
export function useElementScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return { ref, scrollYProgress };
}

/**
 * useParallax - Hook for parallax effects with configurable speed
 * @param speed - Speed multiplier (-1 to 1, negative = slower, positive = faster)
 * @returns MotionValue for transform
 */
export function useParallax(speed: number = 0.5): {
  ref: React.RefObject<HTMLDivElement | null>;
  y: MotionValue<number>;
  x: MotionValue<number>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Calculate movement range based on speed
  const maxOffset = 100 * Math.abs(speed);
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    speed >= 0 ? [-maxOffset, maxOffset] : [maxOffset, -maxOffset]
  );
  const x = useTransform(scrollYProgress, [0, 1], [0, 0]);

  return { ref, y, x };
}

/**
 * useScrollAnimation - Comprehensive hook for scroll-linked animations
 * Returns various transform values based on scroll position
 */
export function useScrollAnimation(options?: {
  offset?: [string, string];
  springConfig?: {
    stiffness?: number;
    damping?: number;
    restDelta?: number;
  };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: (options?.offset || ["start end", "end start"]) as [any, any],
  });

  const springConfig = {
    stiffness: options?.springConfig?.stiffness ?? 100,
    damping: options?.springConfig?.damping ?? 30,
    restDelta: options?.springConfig?.restDelta ?? 0.001,
  };

  const smoothProgress = useSpring(scrollYProgress, springConfig);

  // Common transform presets
  const fadeIn = useTransform(smoothProgress, [0, 0.3], [0, 1]);
  const fadeOut = useTransform(smoothProgress, [0.7, 1], [1, 0]);
  const slideUp = useTransform(smoothProgress, [0, 0.3], [100, 0]);
  const slideDown = useTransform(smoothProgress, [0, 0.3], [-100, 0]);
  const scaleUp = useTransform(smoothProgress, [0, 0.5], [0.8, 1]);
  const scaleDown = useTransform(smoothProgress, [0.5, 1], [1, 0.8]);
  const rotate = useTransform(smoothProgress, [0, 1], [0, 360]);

  return {
    ref,
    scrollYProgress,
    smoothProgress,
    transforms: {
      fadeIn,
      fadeOut,
      slideUp,
      slideDown,
      scaleUp,
      scaleDown,
      rotate,
    },
  };
}

/**
 * useScrollDirection - Detect scroll direction
 */
export function useScrollDirection() {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const updateScrollDirection = () => {
      const currentScrollY = window.scrollY;
      const newDirection = currentScrollY > lastScrollY ? "down" : "up";
      
      if (
        newDirection !== direction &&
        Math.abs(currentScrollY - lastScrollY) > 10
      ) {
        setDirection(newDirection);
      }
      
      setScrollY(currentScrollY);
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", updateScrollDirection);
    return () => window.removeEventListener("scroll", updateScrollDirection);
  }, [direction]);

  return { direction, scrollY };
}

/**
 * useScrollVelocity - Detect scroll speed
 */
export function useScrollVelocity() {
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastTime = Date.now();
    let rafId: number;

    const updateVelocity = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const deltaY = currentScrollY - lastScrollY;
      const deltaTime = currentTime - lastTime;

      if (deltaTime > 0) {
        const newVelocity = Math.abs(deltaY / deltaTime) * 100;
        setVelocity(newVelocity);
      }

      lastScrollY = currentScrollY;
      lastTime = currentTime;
      rafId = requestAnimationFrame(updateVelocity);
    };

    rafId = requestAnimationFrame(updateVelocity);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return velocity;
}

export default useScrollAnimation;
