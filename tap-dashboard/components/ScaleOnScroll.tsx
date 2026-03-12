"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ReactNode, useRef } from "react";

interface ScaleOnScrollProps {
  children: ReactNode;
  className?: string;
  startScale?: number;
  endScale?: number;
  startOpacity?: number;
  endOpacity?: number;
}

/**
 * ScaleOnScroll - Elements scale based on scroll position
 * Perfect for highlighting MoltOS primitives as they come into focus
 */
export function ScaleOnScroll({
  children,
  className = "",
  startScale = 0.8,
  endScale = 1,
  startOpacity = 0.5,
  endOpacity = 1,
}: ScaleOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [startScale, endScale]);
  const opacity = useTransform(scrollYProgress, [0, 1], [startOpacity, endOpacity]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ scale, opacity }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ZoomInOnScroll - Dramatic zoom entrance effect
 */
export function ZoomInOnScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ScaleOnScroll
      className={className}
      startScale={0.5}
      endScale={1}
      startOpacity={0}
      endOpacity={1}
    >
      {children}
    </ScaleOnScroll>
  );
}

/**
 * PulseOnScroll - Subtle pulse effect tied to scroll
 */
export function PulseOnScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [0.9, 1.05, 0.9]
  );

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ scale }}
    >
      {children}
    </motion.div>
  );
}

export default ScaleOnScroll;
