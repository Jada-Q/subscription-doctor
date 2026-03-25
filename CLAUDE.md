# CLAUDE.md

@AGENTS.md

## Project Overview

Subscription Doctor（サブスク診断） — 日本市場向けプライバシーファースト订阅审计工具。用户上传信用卡账单截图，浏览器端 OCR 识别 → 匹配订阅规则 → 检测苹果税/重复订阅 → 生成健康报告。**所有处理在浏览器本地完成，数据不离开设备。**

- **Live**: subscription-doctor.vercel.app
- **Status**: Alpha (v0.2.0) — 104 规则, 2 功能 (診断 + 支払い), 15 test files / 129 tests passing

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # Downloads OCR models + next build
npm test             # vitest run (all tests)
npx vitest run <file>  # Single test file
npm run lint         # ESLint
```

## Tech Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS 4
- PaddleOCR via ONNX Runtime WebAssembly (browser-side OCR)
- Sentry error monitoring, Vercel hosting
- Path alias: `@/*` → `./src/*`

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Main shell + TabNavigator (直接 import, 不用 next/dynamic)
│   ├── privacy/page.tsx          # プライバシーポリシー
│   ├── layout.tsx, globals.css   # Layout + global styles
│   └── spike/ocr/               # OCR spike test page (dev only)
├── features/
│   ├── subscription-doctor/      # 診断機能 — OCR 订阅分析
│   └── payment-calculator/       # 支払い機能 — 信用卡回馈计算
├── components/                   # Shared UI components (re-export from index.ts)
├── lib/
│   ├── ocr/                      # PaddleOCR engine singleton
│   ├── parser/                   # OCR text → structured transactions
│   ├── matcher/                  # Transaction → rule matching + overlap detection
│   ├── report/                   # Score calculation + share card
│   ├── demo/                     # Demo mode mock data
│   ├── rate-limit.ts             # Client-side rate limiting
│   └── analytics.ts              # Analytics helpers
└── data/
    └── rules.json                # 104 subscription rules (核心数据资产)
```

## Data Pipeline (Subscription Doctor)

```
Image → OCR → Parse → Match → Overlap Detection → Report
```

1. **OCR** (`src/lib/ocr/engine.ts`): PaddleOCR singleton, images scaled to max 1600px
2. **Parse** (`src/lib/parser/extract.ts`): Date/description/amount extraction, Japanese date handling, full-width normalization
3. **Match** (`src/lib/matcher/match.ts`): Keyword match against rules.json, amount disambiguation
4. **Overlap** (`src/lib/matcher/match.ts:detectOverlaps`): Bidirectional overlap detection
5. **Report** (`src/lib/report/score.ts`): Score 0-100, Apple tax detection, savings calculation

## Rules Database (`src/data/rules.json`)

Each rule: `id`, `keywords[]`, `amounts[]`, `appStorePrice`, `officialPrice`, `category`, `overlaps[]`, `advice`, `alternatives[]`, `cancelUrl`

When adding rules:
- Keywords must match credit card statement format (uppercase, no spaces)
- `overlaps` must be bidirectional (A→B and B→A)
- `alternatives[].price` must be less than service price

## Code Conventions

- **Tests**: Colocated as `*.test.ts`. Core logic (`src/lib/`, `src/features/*/lib/`) must have tests. UI components do not require tests.
- **Feature modules**: `src/features/<name>/` with `index.ts`, page component, `lib/`, `data/`
- **Shared components**: `src/components/`, re-export from `src/components/index.ts`
- **Japanese UI**: All user-facing text in natural Japanese
- **Inline styles on TabNavigator/page shell**: Tailwind was unreliable here, use `style={{}}`
- **No `console.log`** in committed code
- **All new files must be `git add`ed** — Vercel build fails with module-not-found otherwise

## Environment Variables

All optional for MVP. App runs fully without `.env.local`. See `.env.local.example`.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side error monitoring |
| `SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Server-side Sentry + source maps |
| `GEMINI_API_KEY` / `GEMINI_MODEL_ID` | v1.1 AI fallback (not yet implemented) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | v1.1 future feature |

## Critical Constraints

- **No server-side user data processing** — everything client-side for privacy
- **iOS Safari**: `numThreads = 1` for WASM, max 1600px image, sessionStorage for state persistence
- **OCR models are gitignored**: `public/models/` — downloaded at build time via `scripts/download-models.mjs`
- **`serverExternalPackages: ["onnxruntime-web"]`** required in next.config.ts
- **CSP allows `unsafe-inline` + `unsafe-eval`** — required for ONNX Runtime WASM
- **DO NOT use `next/dynamic`** in `page.tsx` — breaks SSR for page shell and TabNavigator
- **Dev HSTS caveat**: next.config.ts skips HSTS in dev mode. If browser cached HSTS, use different port or `127.0.0.1`
- **OCR dictionary**: `ppocrv5_dict.txt` line 1 is empty CTC blank token — never filter it out
- **Turbopack dev + iOS Safari**: Does NOT work. Must `next build && next start` for iOS testing

## PR / Deploy Checklist

1. `npm test` — all 129 tests green
2. `npm run lint` — zero errors
3. `npm run build` — success
4. All imported files `git add`ed
5. No `console.log` residue
6. Japanese UI text reviewed for natural phrasing

## Error Handling

- localStorage/sessionStorage: `try-catch` with silent ignore
- OCR/pipeline errors: Catch → `setError(msg)` for user-visible message
- Optional services (Sentry, Analytics): Silent fallback, never block core
- Never `catch { console.log() }` alone

## Known Tech Debt

- Affiliate URLs are placeholders (need ASP account registration)
- AI Fallback not implemented (planned Gemini-based for unmatched transactions)
- cancelUrl accuracy may degrade as services restructure URLs
- Rate limit is client-side only (localStorage-based, bypassable)
