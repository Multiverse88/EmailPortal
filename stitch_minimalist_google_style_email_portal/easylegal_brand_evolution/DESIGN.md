---
name: EasyLegal Brand Evolution
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
  on-surface-variant: '#5b403d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#8f706c'
  outline-variant: '#e3beb9'
  surface-tint: '#b6231c'
  primary: '#680003'
  on-primary: '#ffffff'
  primary-container: '#930006'
  on-primary-container: '#ff998c'
  inverse-primary: '#ffb4aa'
  secondary: '#5e5e5c'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfdc'
  on-secondary-container: '#636360'
  tertiary: '#2f3033'
  on-tertiary: '#ffffff'
  tertiary-container: '#46464a'
  on-tertiary-container: '#b5b4b8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410001'
  on-primary-fixed-variant: '#930006'
  secondary-fixed: '#e4e2de'
  secondary-fixed-dim: '#c8c6c3'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#474744'
  tertiary-fixed: '#e3e2e6'
  tertiary-fixed-dim: '#c7c6ca'
  on-tertiary-fixed: '#1a1b1e'
  on-tertiary-fixed-variant: '#46474a'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  surface-cream: '#FDFCFB'
  border-subtle: '#DADCE0'
  legal-red-container: '#FFDAD6'
typography:
  page-title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
  email-subject:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  body-text-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 26px
  label-secondary:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  page-title-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
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
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  sidebar-width: 256px
---

## Brand & Style

This design system evolves the existing functional foundation into a **Legal-Focused Modern Minimalism**. It maintains the "content-first" hierarchy and utilitarian clarity of the original framework while pivoting the emotional tone from "generic productivity" to "professional authority." 

By adopting the rich, deep red of the EasyLegal identity, the interface feels more grounded and reliable. The style remains rooted in Corporate Modernism, utilizing significant whitespace and a structured 8px grid to ensure that complex legal documents and email threads are presented with maximum legibility and zero distraction. The goal is to evoke a sense of calm, precision, and institutional trust.

## Colors

The palette transitions from "Google Blue" to a sophisticated **EasyLegal Red**. This primary accent is used purposefully to drive focus and signify importance without overwhelming the user.

- **Primary:** The rich red (#930006) is reserved for high-impact actions, brand touchpoints, and unread indicators.
- **Secondary/Neutral:** We introduce a subtle cream/off-white tone for secondary backgrounds to soften the interface and provide a more "literary" feel appropriate for legal reading. Pure white is used for the main content containers.
- **Surface Layering:** Surfaces use a hierarchy of warm-tinted neutrals to distinguish between the navigation sidebar (Cream) and the main workspace (White).
- **Text:** High-contrast charcoal (#202124) is used for body text to ensure AA/AAA accessibility compliance on light backgrounds.

## Typography

The design system continues to use **Inter** for its systematic, neutral, and highly legible characteristics. The type scale remains compact to handle information-dense legal workflows.

- **Weight Usage:** Weights are strictly limited to Regular (400) for body text and Medium (500) or Semi-Bold (600) for emphasis.
- **Hierarchy:** Legal subject lines and unread states now use a Semi-Bold weight (600) to stand out more clearly against the primary red accents.
- **Line Height:** A generous 1.6x+ multiplier is applied to all body text to facilitate the reading of long-form legal correspondence.

## Layout & Spacing

The layout is governed by a **Fluid Grid** with fixed functional regions, strictly adhering to an 8px rhythm.

- **Structural Regions:** A fixed-width left sidebar (256px) provides navigation, while the main content area expands to fill the viewport.
- **The 8px Grid:** Every padding, margin, and height attribute must be a multiple of 8px. Internal card padding is standardized at 16px (md) for a breathable, Google-style layout.
- **Responsive Behavior:** Below 1024px, the sidebar collapses into a modal drawer. On mobile devices (<600px), margins are locked to 16px to maintain content alignment.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** rather than heavy shadows, echoing a modern minimalist aesthetic.

- **Level 0 (Flat):** Main workspace and secondary sidebars are flat, using `border-subtle` (#DADCE0) to define boundaries.
- **Level 1 (Subtle):** Cards and active "Compose" buttons use a minimal 2dp shadow (0px 1px 3px rgba(0,0,0,0.08)) to appear slightly lifted.
- **Interaction:** Hover states utilize a subtle background shift to `secondary-color` (Cream) or a 1px border reinforcement rather than increased elevation.
- **Focus:** The Search Bar and high-priority modals use Backdrop Blurs (10px) to maintain context while focusing the user's attention.

## Shapes

The shape language reflects the EasyLegal logo's balance of rounded corners and professional structure.

- **Standard (8px):** Applied to most containers, input fields, and standard buttons to maintain a modern, friendly-yet-professional look.
- **Pill (Full):** Exclusively used for global actions like the "Compose" button, the primary search bar, and active navigation indicators. This differentiation helps users immediately identify "The Next Action."
- **Dividers:** 1px horizontal rules using `border-subtle` are used to separate items in lists without creating visual noise.

## Components

- **Buttons:** 
    - *Primary:* Pill-shaped, filled with EasyLegal Red (#930006), featuring white text.
    - *Secondary:* 8px rounded, light cream background with red text.
- **Compose Button:** Large, pill-shaped FAB-style button with a subtle shadow and the primary brand color.
- **Search Bar:** Pill-shaped, fixed at the top of the interface. Uses a `neutral-color` background with a subtle inset border.
- **Email/Document List Items:** 56px height. Unread items feature a 4px vertical "pill" indicator in EasyLegal Red on the left edge.
- **Input Fields:** 8px rounded with a 1px `border-subtle`. On focus, the border color transitions to the primary red with a 2px stroke.
- **Chips:** Small, pill-shaped markers for status (e.g., "Urgent", "Reviewed") using tinted variations of the primary color palette.