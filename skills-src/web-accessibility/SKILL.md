---
name: web-accessibility
description: Build web UIs that meet WCAG 2.2 AA. Use when creating or reviewing forms, navigation, dialogs, interactive widgets, images or colour choices.
metadata:
  stack-any: web-frontend
---

# Web accessibility (WCAG 2.2 AA)

## Structure
- One `h1` per page and headings in order; landmarks via `header`, `nav`, `main`, `footer`.
- Set `lang` on `<html>` and a unique, descriptive `<title>` per page.
- Provide a "Skip to content" link as the first focusable element.

## Keyboard
- Everything clickable is reachable and operable with the keyboard, in a logical order.
- Use native `button` and `a`; a `div` with `onClick` is not accessible.
- Visible focus on every focusable element (`:focus-visible`), never `outline: none` without a replacement.
- Dialogs trap focus, close on Escape and return focus to the trigger; prefer the native `<dialog>` element.

## Forms
- Every field has a visible `<label>` tied with `for`/`id`; placeholders are not labels.
- Group related inputs with `fieldset` + `legend`.
- Announce errors in text next to the field, link them with `aria-describedby`, and move focus to the first error on submit.
- Set `autocomplete` tokens for personal data.

## Content
- Meaningful images get alt text that says what the image conveys; decorative ones get `alt=""`.
- Colour is never the only signal (add icons or text). Text contrast ≥ 4.5:1, UI components ≥ 3:1.
- Touch targets at least 24×24 CSS px.
- Respect `prefers-reduced-motion`; no content flashes more than three times per second.

## ARIA
- No ARIA is better than wrong ARIA. Use it only to fill gaps native HTML cannot.
- Live regions (`aria-live="polite"`) for async status messages like "Saved".

## Testing
- Run axe (browser extension or `@axe-core/playwright`) in CI, then test by hand with keyboard only and a screen reader (VoiceOver, NVDA).
