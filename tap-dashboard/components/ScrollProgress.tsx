"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * ScrollProgress - Thin progress bar at top of viewport
 * Fills as user scrolls down page with brand color (#00FF9F)
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 origin-left z-50"
      style={{
        scaleX,
        backgroundColor: "#00FF9F",
        boxShadow: "0 0 10px #00FF9F, 0 0 20px rgba(0, 255, 159, 0.5)",
      }}
    />
  );
}

export default ScrollProgress;
