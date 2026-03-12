# MoltOS Scrollytelling System

A complete scroll-linked animation system built with Framer Motion for immersive storytelling experiences.

## Components

### ScrollProgress
Thin progress bar at top of viewport that fills as user scrolls.

```tsx
import { ScrollProgress } from "@/components/ScrollProgress";

export default function Layout() {
  return (
    <>
      <ScrollProgress />
      <main>{/* content */}</main>
    </>
  );
}
```

### FadeInSection
Elements fade and slide in as they enter viewport.

```tsx
import { FadeInSection } from "@/components/FadeInSection";

<FadeInSection 
  direction="up"     // "up" | "down" | "left" | "right"
  delay={0.2}        // Delay in seconds
  duration={0.6}     // Animation duration
  distance={50}      // Slide distance in pixels
  once={true}        // Only animate once
  threshold={0.2}    // Trigger threshold (0-1)
>
  <YourContent />
</FadeInSection>
```

### ParallaxLayer
Elements move at different speeds creating depth.

```tsx
import { ParallaxLayer } from "@/components/ParallaxLayer";

<ParallaxLayer 
  speed={0.5}           // -1 (slower) to 1 (faster)
  direction="vertical"  // "vertical" | "horizontal"
  offset={100}          // Max pixels to move
>
  <BackgroundImage />
</ParallaxLayer>
```

**Convenience Components:**
- `ParallaxBackground` - Preset slower layer for backgrounds
- `ParallaxForeground` - Preset faster layer for foreground elements

### ScaleOnScroll
Elements scale based on scroll position.

```tsx
import { ScaleOnScroll, ZoomInOnScroll } from "@/components/ScaleOnScroll";

<ScaleOnScroll 
  startScale={0.8}    // Initial scale
  endScale={1}        // Final scale
  startOpacity={0.5}  // Initial opacity
  endOpacity={1}      // Final opacity
>
  <YourContent />
</ScaleOnScroll>

// Or use presets:
<ZoomInOnScroll><YourContent /></ZoomInOnScroll>
<PulseOnScroll><YourContent /></PulseOnScroll>
```

### PinSection
Section pins while content scrolls past - perfect for step-by-step storytelling.

```tsx
import { PinSection } from "@/components/PinSection";

<PinSection 
  pinDuration={2}  // Viewport heights to pin for
>
  <StepContent />
</PinSection>
```

## Hooks

### useScrollProgress
Returns normalized scroll progress (0 to 1) with smooth spring physics.

```tsx
import { useScrollProgress } from "@/hooks/useScrollAnimation";

function MyComponent() {
  const progress = useScrollProgress();
  // Returns MotionValue from 0 to 1
  
  return <motion.div style={{ opacity: progress }} />;
}
```

### useParallax
Hook for creating parallax effects with configurable speed.

```tsx
import { useParallax } from "@/hooks/useScrollAnimation";

function MyComponent() {
  const { ref, y } = useParallax(0.5); // speed: -1 to 1
  
  return (
    <motion.div ref={ref} style={{ y }}>
      Parallax Content
    </motion.div>
  );
}
```

### useScrollAnimation
Comprehensive hook for scroll-linked animations.

```tsx
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

function MyComponent() {
  const { ref, smoothProgress, transforms } = useScrollAnimation({
    offset: ["start end", "end start"],
    springConfig: { stiffness: 100, damping: 30 },
  });
  
  const { fadeIn, scaleUp, rotate } = transforms;
  
  return (
    <motion.div 
      ref={ref}
      style={{ opacity: fadeIn, scale: scaleUp }}
    >
      Content
    </motion.div>
  );
}
```

### Additional Hooks

```tsx
import { 
  useScrollDirection,   // Returns "up" | "down" | null
  useScrollVelocity,    // Returns scroll speed
  useElementScrollProgress // Per-element progress
} from "@/hooks/useScrollAnimation";
```

## Brand Colors

- Primary: `#00FF9F` (MoltOS Green)
- Background: Slate 950 (`#020617`)
- Text: White with Slate 400 for secondary

## Example: MoltOS Story

See `/app/moltos-story/page.tsx` for a complete implementation showcasing all 10 primitives with:
- Hero zoom entrance
- Staggered pinned sections for each primitive
- Parallax background effects
- Progress indicator
- Fade-in content reveals
