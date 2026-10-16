---
name: tailwind-css-conventions
description: Write consistent, maintainable Tailwind CSS. Use when styling components with Tailwind utilities, theming, or setting up Tailwind configuration.
metadata:
  stack-any: tailwind
---

# Tailwind CSS conventions

## Setup
- Check the installed major version first. Tailwind v4 configures the theme in CSS with `@import "tailwindcss";` and `@theme { ... }`; v3 uses `tailwind.config.js`.
- Define design tokens (colours, fonts, radii, spacing extensions) in the theme once; do not hard-code hex values in class names (`bg-[#123456]`) except for one-offs.

## Class usage
- Mobile-first: unprefixed classes for small screens, then `sm:` `md:` `lg:`.
- Keep class order consistent; use the official Prettier plugin to sort classes.
- Merge conditional classes with `clsx` + `tailwind-merge` (a `cn()` helper) so later classes override earlier ones predictably.
- When a class list repeats, extract a component, not an `@apply` rule. Reserve `@apply` for styling third-party markup.
- Build variant APIs with `class-variance-authority` (or a small map) instead of string concatenation.

## Theming
- Use CSS variables for themeable values and switch them for dark mode (`dark:` variant or a `data-theme` attribute).
- Check contrast for text on coloured backgrounds in both themes.

## Accessibility and states
- Style focus with `focus-visible:` rings; never remove outlines without a replacement.
- Cover `hover:`, `focus-visible:`, `disabled:` and `aria-*` states for interactive elements.
- Respect `motion-reduce:` for animations.

## Content detection
- Dynamic class names must appear in full in source (`bg-red-500`, not `bg-${color}-500`), or they will be purged.
