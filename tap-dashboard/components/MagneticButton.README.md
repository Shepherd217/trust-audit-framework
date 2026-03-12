# MoltOS Magnetic Button System

A delightful interactive button system with magnetic cursor attraction, ripple effects, and micro-interactions.

## Components

### MagneticButton

An interactive button that subtly moves toward the cursor with spring physics.

```tsx
import { MagneticButton } from "@/components/MagneticButton";

// Basic usage
<MagneticButton>Click Me</MagneticButton>

// With variant and size
<MagneticButton variant="primary" size="lg">Large Primary</MagneticButton>

// With icons
<MagneticButton icon={<DownloadIcon />} iconPosition="left">
  Download
</MagneticButton>

// As a link
<MagneticButton href="/install" showArrow>
  Get Started
</MagneticButton>

// Custom magnetic strength
<MagneticButton magneticStrength={0.5}>
  Strong Magnetism
</MagneticButton>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"primary" \| "secondary" \| "ghost"` | `"primary"` | Button color variant |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |
| `href` | `string` | - | Renders as anchor tag if provided |
| `magneticStrength` | `number` | `0.3` | Strength of magnetic pull (0-1) |
| `springStiffness` | `number` | `150` | Spring stiffness for physics |
| `springDamping` | `number` | `15` | Spring damping for physics |
| `icon` | `ReactNode` | - | Icon to display |
| `iconPosition` | `"left" \| "right"` | `"left"` | Icon position |
| `showArrow` | `boolean` | `false` | Show animated arrow |
| `glowOnHover` | `boolean` | `true` | Intensify glow on hover |
| `disabled` | `boolean` | `false` | Disable the button |
| `className` | `string` | - | Additional Tailwind classes |
| `ariaLabel` | `string` | - | Accessibility label |

### RippleEffect

Ripple effect component that can be used standalone or via the `useRipple` hook.

```tsx
import { RippleEffect, useRipple } from "@/components/RippleEffect";

// Using the hook
function MyComponent() {
  const { ripples, createRipple, RippleComponent } = useRipple();
  
  return (
    <button onClick={createRipple}>
      Click me
      <RippleComponent variant="primary" />
    </button>
  );
}

// Using RippleContainer for non-button elements
import { RippleContainer } from "@/components/RippleEffect";

<RippleContainer className="p-4 rounded-lg">
  Click anywhere on this card
</RippleContainer>
```

## Features

### Magnetic Effect
- Smooth spring physics cursor attraction
- Configurable strength and physics parameters
- Works with all button sizes

### Micro-interactions
- **Ripple effect**: Expands from click point on press
- **Scale down**: Button slightly shrinks when pressed
- **Glow intensification**: Glow increases on hover
- **Icon animations**: Icons slide on hover
- **Arrow animation**: Arrows slide right on hover

### Accessibility
- Full keyboard navigation support
- Visible focus rings
- Ripple effect triggers on keyboard activation
- ARIA attributes supported
- Disabled state properly handled

### Variants

**Primary**
- MoltOS green (#00FF9F) background
- Black text
- Glowing shadow on hover

**Secondary**
- Dark surface background
- White text
- Subtle border

**Ghost**
- Transparent background
- MoltOS green text
- Border that highlights on hover

## Examples

See `MagneticButtonDemo.tsx` for comprehensive examples of all features.
