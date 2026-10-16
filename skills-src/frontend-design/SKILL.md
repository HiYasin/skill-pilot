---
name: frontend-design
description: Make deliberate visual design decisions for web interfaces. Use when designing or restyling pages, layouts, components, typography or colour.
metadata:
  stack-any: web-frontend
---

# Frontend design

## Start from intent
- Name the page's one job and the single action you want users to take; design the hierarchy around it.
- Pick a clear direction (calm and editorial, dense and technical, bold and playful) and apply it consistently instead of mixing defaults.

## Layout
- Use a spacing scale (4 or 8 px steps) and stick to it.
- Limit line length to about 60–75 characters for body text.
- Align to a grid; group related items with proximity, separate unrelated ones with space before reaching for borders.
- Design mobile first, then add columns where there is room.

## Typography
- Two typefaces at most; establish a type scale (e.g. 14 / 16 / 20 / 24 / 32 / 48).
- Body text 16 px or larger, line height 1.4–1.6; headings tighter.
- Use weight and size for hierarchy before colour.

## Colour
- One primary accent, neutrals for most of the UI, semantic colours for success, warning and error.
- Meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text and UI parts).
- Plan dark mode with tokens from the start.

## Components and states
- Every interactive element needs hover, focus-visible, active, disabled and loading states.
- Design empty, error and loading states for every data view, not only the happy path.
- Keep motion short (150–250 ms), purposeful, and disabled under `prefers-reduced-motion`.

## Review checklist
- Can a new visitor tell what the page is for in five seconds?
- Is there exactly one most prominent action?
- Does it hold up at 360 px wide and at 200% zoom?
