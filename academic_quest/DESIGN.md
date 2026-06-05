---
name: Academic Quest
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#464555'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4f44e2'
  primary: '#4d41df'
  on-primary: '#ffffff'
  primary-container: '#675df9'
  on-primary-container: '#fffbff'
  inverse-primary: '#c4c0ff'
  secondary: '#ae2f34'
  on-secondary: '#ffffff'
  secondary-container: '#ff6b6b'
  on-secondary-container: '#6d0010'
  tertiary: '#006762'
  on-tertiary: '#ffffff'
  tertiary-container: '#00837c'
  on-tertiary-container: '#f3fffd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c4c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#3622ca'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b0'
  on-secondary-fixed: '#410006'
  on-secondary-fixed-variant: '#8c1520'
  tertiary-fixed: '#7cf6ec'
  tertiary-fixed-dim: '#5dd9d0'
  on-tertiary-fixed: '#00201e'
  on-tertiary-fixed-variant: '#00504c'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-hero:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  display-hero-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

This design system is built to transform the mundane chore of university attendance into an engaging, gamified experience. The brand personality is energetic, rewarding, and student-centric, moving away from "surveillance" toward "participation."

The aesthetic draws from **Modernism mixed with Gamified UI**—utilizing high-energy colors, tactile elements, and "juice" (feedback animations/glows) found in mobile games. It prioritizes clarity for quick interactions during a lecture while maintaining a sense of fun through emoji support, vibrant badges, and soft, approachable surfaces.

## Colors

The palette is anchored by **Vibrant Purple** to denote authority and action without being sterile. **Coral** acts as the high-energy motivator for achievements and leaderboards, while **Bright Blue** is reserved for personal user highlighting and interactive accents.

Backgrounds utilize a very light gray to reduce eye strain in varying lecture hall lighting, providing a neutral canvas for high-chroma components. Success states use a vivid green to provide immediate positive reinforcement for completed "quests" (classes).

## Typography

Typography balances the bold, geometric energy of **Montserrat** for headings with the high legibility of **Inter** for functional data. 

Headings should use heavy weights (700-800) to mimic game titles. Body text is kept clean and spacious. Label styles utilize uppercase and bold weights to clearly define metadata like "WEEK 04" or "LECTURE HALL B."

## Layout & Spacing

This design system follows a **Mobile-First, Fluid Grid** philosophy. On mobile devices, the system uses a 4-column grid with 20px side margins to ensure the interface feels spacious and "un-cluttered." 

Spacing is based on an 8px rhythm to ensure consistent alignment. For tablet and desktop views, the content max-width is capped at 600px to maintain the "handheld game" feel and prevent line lengths from becoming unreadable.

## Elevation & Depth

Depth is achieved through **Soft Ambient Shadows** rather than harsh borders. Layers should feel like they are floating slightly above the background.

- **Level 1 (Base Cards):** Y: 4, Blur: 12, Color: #000 (5% opacity).
- **Level 2 (Active/Interactive):** Y: 8, Blur: 20, Color: Primary (15% opacity).
- **CTA Glow:** Apply an outer spread of 10px using the Primary or Success color at 40% opacity to create a "pulsing" or "glowing" effect for high-priority actions like "Check In."

## Shapes

The shape language is defined by **large, friendly radii**. Elements like attendance cards, leaderboard rows, and main action buttons use a 1.5rem (24px) corner radius to create a soft, toy-like appearance. 

Progress trackers and status pills use full-round (pill) shapes to signify fluidity and movement.

## Components

### Buttons
- **Primary Action:** Solid Primary Purple with a subtle gradient and a soft glow effect. Text is always bold Montserrat.
- **Secondary Action:** Ghost style with a 2px stroke of the Primary color and high-rounded corners.

### Attendance Cards
- Feature a left-hand accent bar indicating subject color.
- High-contrast typography for the subject name.
- Integrated "Points Badge" in the top right corner.

### Points & Streak Badges
- Small, vibrant containers with 12px rounding.
- Use emoji prefixes (🔥 for streaks, ⭐ for bonus points).
- High-saturation backgrounds with white text.

### Progress Tracker
- A horizontal sequence of 16 "Progress Pills."
- **Empty State:** Neutral light gray.
- **Completed:** Success Green.
- **Missed:** Soft Gray-Red.

### Inputs
- Large, easy-to-tap fields with 16px padding and 1.5rem rounded corners. 
- Focus state triggers a primary color border and light purple glow.