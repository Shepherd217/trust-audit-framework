"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ReactNode, useRef } from "react";

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  speed?: number; // -1 (slower) to 1 (faster), 0 = normal scroll
  direction?: "vertical" | "horizontal";
  offset?: number; // Max pixels to move
}

/**
 * ParallaxLayer - Elements move at different speeds
 * Creates depth in the MoltOS story by moving background/foreground elements at different rates
 */
export function ParallaxLayer({
  children,
  className = "",
  speed = 0.5,
  direction = "vertical",
  offset = 100,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Calculate movement based on speed
  // speed: -1 moves slower (parallax background), 1 moves faster (foreground)
  const moveDistance = offset * speed;

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    direction === "vertical" ? [-moveDistance, moveDistance] : [0, 0]
  );

  const x = useTransform(
    scrollYProgress,
    [0, 1],
    direction === "horizontal" ? [-moveDistance, moveDistance] : [0, 0]
  );

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxBackground - Slower moving background layer
 * Perfect for decorative elements behind content
 */
export function ParallaxBackground({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ParallaxLayer speed={-0.3} offset={150} className={className}>
      {children}
    </ParallaxLayer>
  );
}

/**
 * ParallaxForeground - Faster moving foreground layer
 * Creates dramatic entrance effects
 */
export function ParallaxForeground({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ParallaxLayer speed={0.5} offset={80} className={className}>
      {children}
    </ParallaxLayer>
  );
}

export default ParallaxLayer;
