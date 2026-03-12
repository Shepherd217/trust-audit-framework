"use client";

/**
 * MoltOS Scrollytelling Page
 * 
 * Demonstrates the complete scrollytelling system with:
 * - ScrollProgress indicator
 * - FadeInSection for content reveals
 * - ParallaxLayer for depth
 * - ScaleOnScroll for emphasis
 * - PinSection for step-by-step storytelling
 */

import { ScrollProgress } from "@/components/ScrollProgress";
import { FadeInSection } from "@/components/FadeInSection";
import { ParallaxLayer, ParallaxBackground, ParallaxForeground } from "@/components/ParallaxLayer";
import { ScaleOnScroll, ZoomInOnScroll } from "@/components/ScaleOnScroll";
import { PinSection } from "@/components/PinSection";
import { motion } from "framer-motion";

// MoltOS 10 Primitives
const primitives = [
  { name: "Agents", description: "Autonomous entities that perceive and act", icon: "🤖" },
  { name: "Memory", description: "Persistent state across sessions", icon: "🧠" },
  { name: "Tools", description: "Capabilities that extend agent power", icon: "🔧" },
  { name: "Planning", description: "Strategic thinking and task decomposition", icon: "📋" },
  { name: "Reasoning", description: "Logical inference and decision making", icon: "💭" },
  { name: "Perception", description: "Understanding the environment", icon: "👁️" },
  { name: "Action", description: "Executing changes in the world", icon: "⚡" },
  { name: "Learning", description: "Improvement from experience", icon: "📈" },
  { name: "Collaboration", description: "Multi-agent coordination", icon: "🤝" },
  { name: "Safety", description: "Alignment and harm prevention", icon: "🛡️" },
];

export default function MoltOSStory() {
  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <!-- Scroll Progress Bar -->
      <ScrollProgress />

      <!-- Hero Section -->
      <section className="h-screen flex items-center justify-center relative overflow-hidden">
        <ParallaxBackground className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-slate-950" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl" />
        </ParallaxBackground>

        <ZoomInOnScroll className="text-center z-10 px-4">
          <motion.h1 
            className="text-6xl md:text-8xl font-bold mb-6"
            style={{ textShadow: "0 0 40px rgba(0, 255, 159, 0.3)" }}
          >
            <span className="text-[#00FF9F]">Molt</span>OS
          </motion.h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto">
            The Agent Operating System
          </p>
          <motion.div 
            className="mt-12 text-sm text-slate-500"
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            Scroll to explore ↓
          </motion.div>
        </ZoomInOnScroll>
      </section>

      <!-- Introduction -->
      <section className="min-h-screen flex items-center justify-center px-4 py-24">
        <FadeInSection direction="up" className="max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">
            10 Primitives. <span className="text-[#00FF9F]">Infinite Possibilities.</span>
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            MoltOS is built on foundational primitives that enable agents to perceive, 
            reason, plan, and act in complex environments. Each primitive represents 
            a core capability that, when combined, creates emergent intelligence.
          </p>
        </FadeInSection>
      </section>

      <!-- Primitives Scrollytelling -->
      <section className="relative">
        {primitives.map((primitive, index) => (
          <PinSection
            key={primitive.name}
            className="flex items-center justify-center px-4"
            pinDuration={1.5}
          >
            <div className="max-w-4xl w-full">
              <ParallaxLayer 
                speed={index % 2 === 0 ? -0.2 : 0.2} 
                offset={50}
                className="absolute inset-0 pointer-events-none"
              >
                <div 
                  className={`absolute ${index % 2 === 0 ? 'left-10' : 'right-10'} top-1/2 
                    w-32 h-32 rounded-full blur-3xl opacity-20`}
                  style={{ backgroundColor: "#00FF9F" }}
                />
              </ParallaxLayer>

              <FadeInSection delay={0.2}>
                <ScaleOnScroll startScale={0.9} endScale={1}>
                  <div className="text-center relative z-10">
                    <div className="text-8xl mb-6">{primitive.icon}</div>
                    <div className="text-[#00FF9F] text-sm font-mono mb-4">
                      PRIMITIVE {String(index + 1).padStart(2, '0')} / 10
                    </div>
                    
                    <h3 className="text-5xl md:text-7xl font-bold mb-6">
                      {primitive.name}
                    </h3>
                    
                    <p className="text-xl md:text-2xl text-slate-400 max-w-xl mx-auto">
                      {primitive.description}
                    </p>

                    <div className="mt-12 flex justify-center gap-2">
                      {primitives.map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === index ? 'bg-[#00FF9F]' : 'bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </ScaleOnScroll>
              </FadeInSection>
            </div>
          </PinSection>
        ))}
      </section>

      <!-- CTA Section -->
      <section className="min-h-screen flex items-center justify-center px-4">
        <FadeInSection direction="up">
          <div className="text-center max-w-3xl">
            <h2 className="text-5xl md:text-6xl font-bold mb-8">
              Ready to build the future?
            </h2>
            
            <p className="text-xl text-slate-400 mb-12">
              Join the MoltOS ecosystem and start building intelligent agents today.
            </p>

            <motion.button
              className="px-8 py-4 rounded-full font-semibold text-lg"
              style={{ 
                backgroundColor: "#00FF9F",
                color: "#0a0a0a",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </div>
        </FadeInSection>
      </section>

      <!-- Footer -->
      <footer className="py-12 border-t border-slate-800">
        <FadeInSection
direction="up"
className="text-center text-slate-500"
        >
          <p>MoltOS - The Agent Operating System © 2026</p>
        </FadeInSection>
      </footer>
    </div>
  );
}
