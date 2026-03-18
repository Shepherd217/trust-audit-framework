"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ReactNode, useRef } from "react";

interface PinSectionProps {
  children: ReactNode;
  className?: string;
  pinDuration?: number; // Viewport heights to pin for
  backgroundChildren?: ReactNode; // Content that scrolls past
}

/**
 * PinSection - Section pins while content scrolls past
 * Perfect for step-by-step storytelling of MoltOS primitives
 */
export function PinSection({
  children,
  className = "",
  pinDuration = 2,
  backgroundChildren,
}: PinSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", `end ${100 - pinDuration * 100}%`],
  });

  const opacity = useTransform(scrollYProgress, [0.8, 1], [1, 0]);
  const scale = useTransform(scrollYProgress, [0.8, 1], [1, 0.95]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `${(1 + pinDuration) * 100}vh` }}
    >
      {/* Pinned content */}
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div
          className={`h-full w-full ${className}`}
          style={{ opacity, scale }}
        >
          {children}
        </motion.div>
      </div>

      {/* Scrolling background content */}
      {backgroundChildren && (
        <div className="absolute inset-0 pointer-events-none">
          {backgroundChildren}
        </div>
      )}
    </div>
  );
}

/**
 * StackedPinSection - Multiple pinned sections that stack
 */
export function StackedPinSection({
  children,
  className = "",
  index = 0,
  total = 1,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  total?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [100, 0]
  );

  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    [0.9, 1]
  );

  return (
    <div
      ref={ref}
      className="h-screen sticky top-0"
      style={{ zIndex: index + 1 }}
    >
      <motion.div
        className={`h-full w-full ${className}`}
        style={{ y, scale }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default PinSection;
