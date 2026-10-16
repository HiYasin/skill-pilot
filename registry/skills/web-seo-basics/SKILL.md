---
name: web-seo-basics
description: Apply technical SEO to public web pages. Use when building landing pages, blogs, product pages, metadata, sitemaps or structured data.
metadata:
  stack-any: web-frontend
---

# Web SEO basics

## Every indexable page
- Unique `<title>` (about 50–60 characters) and meta description (about 150–160 characters).
- A canonical URL (`<link rel="canonical">`) to avoid duplicates from query strings and trailing slashes.
- One `h1` that matches the page's topic; descriptive headings below it.
- Open Graph and Twitter card tags with a 1200×630 image for link previews.

## Crawling and indexing
- Serve meaningful HTML from the server (SSR or static generation) for pages that must rank.
- Generate `sitemap.xml` from your routes and reference it in `robots.txt`.
- Block private areas (dashboards, admin, search results) with `noindex` and keep them out of the sitemap.
- Return real status codes: 404 for missing pages, 301 for permanent moves.

## URLs and links
- Short, lowercase, hyphenated, human-readable slugs. Keep them stable.
- Use real `<a href>` links for navigation so crawlers can follow them; descriptive anchor text, not "click here".

## Structured data
- Add JSON-LD for the page type (Organization, Product, Article, BreadcrumbList, FAQPage) and validate it with Google's Rich Results Test.

## Performance and media
- Meet Core Web Vitals: LCP under 2.5 s, INP under 200 ms, CLS under 0.1.
- Set width and height on images, lazy-load below-the-fold media, serve modern formats (AVIF/WebP).

## International sites
- Use `hreflang` alternates for each language version and a self-reference on every page.
