# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run build        # Downloads OCR models + next build (Turbopack)
npm run dev          # Next.js dev server
npm test             # vitest run (all tests)
npx vitest run src/lib/parser/extract.test.ts  # Single test file
npm run lint         # ESLint
```

The build script runs `scripts/download-models.mjs` before `next build`. This downloads PaddleOCR ONNX models and WASM files to `public/models/`. These files are gitignored and must be downloaded on each fresh environment (CI, Vercel).

`npm test` should produce **8 test files, 74 tests, all passing**. If any test fails, do not commit.

## Code Conventions

- **Test files**: Colocated with source as `*.test.ts`. Core logic (`src/lib/`, `src/features/*/lib/`) must have tests. UI components do not require tests.
- **Feature modules**: New features go in `src/features/<name>/` with their own `index.ts`, page component, `lib/`, and `data/` as needed.
- **Shared components**: Reusable UI goes in `src/components/` and must be re-exported from `src/components/index.ts`.
- **All new files must be `git add`ed before pushing** — the Vercel build will fail with module-not-found if any imported file is untracked.
- **Inline styles on layout-critical elements** (TabNavigator, page shell): Tailwind classes have been unreliable here, use `style={{}}` instead.
- **Japanese UI text**: All user-facing strings are in Japanese. Advice, labels, and error messages must be written in natural Japanese.

## Environment Variables

All env vars are **optional** for the core MVP. The app runs fully without any `.env.local`.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | No | Client-side error monitoring |
| `SENTRY_DSN` | No | Server-side error monitoring |
| `SENTRY_ORG` / `SENTRY_PROJECT` | No | Sentry source map upload (CI only) |
| `SENTRY_AUTH_TOKEN` | No | Sentry source map upload (CI only) |
| `GEMINI_API_KEY` | No | v1.1 AI fallback for unmatched services |
| `NEXT_PUBLIC_SUPABASE_URL` | No | v1.1 future feature |

If `SENTRY_AUTH_TOKEN` is missing, source map upload is silently disabled (`sourcemaps.disable` in next.config.ts).

## Known Issues / Tech Debt

- **Affiliate URLs are placeholders**: `affiliateUrl` in `data/templates.ts` currently points to official card issuer websites, not ASP tracking links (A8.net / もしもアフィリエイト). Requires ASP account registration to replace.
- **AI Fallback not implemented**: Planned Gemini-based identification for unmatched transactions (`GEMINI_API_KEY`). Would be the first server-side API route.
- **`next/dynamic` breaks page shell SSR**: Do NOT use `dynamic()` imports in `page.tsx` — the wrapper div and TabNavigator will not render in SSR output, leaving only the feature page content visible.
- **cancelUrl accuracy**: URLs point to official account/cancel pages but services may restructure their URLs. Some point to support landing pages rather than direct cancel buttons.

## Architecture

Japanese-language privacy-first app that analyzes credit card statement screenshots to detect subscription waste. **All processing happens in-browser** — no data leaves the client.

### Tech Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS 4
- PaddleOCR via ONNX Runtime WebAssembly (browser-side OCR)
- Sentry for error monitoring, Vercel for hosting
- Path alias: `@/*` → `./src/*`

### Two Features (Tab Navigation)
- **診断 (Doctor)**: `src/features/subscription-doctor/` — OCR-based subscription analysis
- **支払い (Payment)**: `src/features/payment-calculator/` — credit card reward optimizer

`src/app/page.tsx` is a thin shell with `TabNavigator` and direct imports (not dynamic — SSR breaks with `next/dynamic` here).

### Data Pipeline (Subscription Doctor)

```
Image → OCR → Parse → Match → Overlap Detection → Report
```

1. **OCR** (`src/lib/ocr/engine.ts`): PaddleOCR singleton, images scaled to max 1600px (iOS memory), models from `public/models/`
2. **Parse** (`src/lib/parser/extract.ts`): Extracts date/description/amount from OCR text. Handles Japanese date formats, full-width characters, retroactive date assignment
3. **Match** (`src/lib/matcher/match.ts`): Matches against `src/data/rules.json` (100+ services). Exact keyword match → partial match → unmatched. Disambiguates by amount when keywords overlap (e.g., "APPLE COM BILL" for different iCloud plans)
4. **Overlap** (`src/lib/matcher/match.ts:detectOverlaps`): Finds duplicate services using bidirectional `overlaps[]` arrays in rules
5. **Report** (`src/lib/report/score.ts`): Score 0-100, Apple tax detection (appStorePrice - officialPrice), savings calculation

### Rules Database (`src/data/rules.json`)

Each rule has: `id`, `keywords[]`, `amounts[]` (for disambiguation, empty = match any), `appStorePrice`, `officialPrice`, `category`, `overlaps[]`, `advice`, `alternatives[]`, `cancelUrl`. When adding rules:
- Keywords must match how the merchant appears on credit card statements (uppercase, no spaces)
- `overlaps` must be bidirectional (if A overlaps B, B must overlap A)
- `alternatives[].price` must be less than the service price (validated)

### Payment Calculator

`src/features/payment-calculator/lib/calculate.ts`: Ranks credit cards by cashback. Priority: active campaign rate > category rate > base rate. Card templates in `data/templates.ts`, user selections persisted in localStorage.

### Key Constraints
- **No server-side processing**: Everything runs client-side for privacy. No API routes for user data.
- **iOS Safari**: sessionStorage for state persistence (survives page reloads during OCR), 1600px max image dimension for WASM memory
- **OCR models are gitignored**: `public/models/*.onnx`, `*.wasm`, `*.mjs`, `*.txt` — downloaded at build time
- **`serverExternalPackages: ["onnxruntime-web"]`** in next.config.ts is required
- **Inline styles on TabNavigator/page shell**: Tailwind classes were unreliable in this context
- **CSP allows `unsafe-inline` and `unsafe-eval`**: Required for ONNX Runtime WASM execution
- **Dev server HSTS caveat**: `next.config.ts` skips HSTS and `upgrade-insecure-requests` in development mode (`isDev` flag). If the browser cached HSTS from a previous session, use a different port or `127.0.0.1` instead of `localhost`.
