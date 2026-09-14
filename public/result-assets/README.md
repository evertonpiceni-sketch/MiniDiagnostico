# Result assets

This directory is the canonical visual source for the result screen hero assets.

Rules:
- Result text comes exclusively from `src/result-content.ts`.
- Result hero images must be text-free assets stored in this directory.
- `src/result-enhancer.ts` must not render or crop legacy PDFs to obtain hero images.
- Static PDFs under `public/result-pdf/` are download artifacts, not sources for the online layout.

Expected canonical files:
- `medo-hero.jpg`
- `inseguranca-hero.jpg`
- `procrastinacao-hero.jpg`
