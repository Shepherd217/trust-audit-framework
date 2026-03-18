"use client";

import { motion, useInView } from "framer-motion";
import { useRef, ReactNode } from "react";

interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  threshold?: number;
}

/**
 * FadeInSection - Elements fade + slide in as they enter viewport
 * Used for revealing content as users scroll through the MoltOS story
 */
export function FadeInSection({
  children,
  className = "",
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance = 50,
  once = true,
  threshold = 0.2,
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { y: distance, x: 0 };
      case "down":
        return { y: -distance, x: 0 };
      case "left":
        return { x: distance, y: 0 };
      case "right":
        return { x: -distance, y: 0 };
      default:
        return { y: distance, x: 0 };
    }
  };

  const initial = getInitialPosition();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...initial }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, ...initial }
      }
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export default FadeInSection;
