/**
 * Any of these packages marks the project as a web frontend. Skills reach
 * every frontend with `stack-any: web-frontend`.
 */
export const FRONTEND_PACKAGES = new Set([
  "react",
  "react-dom",
  "next",
  "vue",
  "nuxt",
  "svelte",
  "@sveltejs/kit",
  "astro",
  "@angular/core",
  "solid-js",
  "preact",
  "@remix-run/react",
  "react-router",
  "@tanstack/react-start",
]);

/** Files that mark a web frontend when no frontend package is present (e.g. Laravel Blade, plain HTML). */
export const WEB_FRONTEND_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".vue",
  ".svelte",
  ".jsx",
  ".tsx",
  ".twig",
  ".ejs",
  ".hbs",
  ".pug",
  ".njk",
]);
