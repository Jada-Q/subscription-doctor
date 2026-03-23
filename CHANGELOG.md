# Changelog

## [0.2.0] - 2026-03-23

### Added
- Payment calculator feature (支払い計算器) with tab navigation
- 104 subscription service rules (expanded from 36)
- Cancel URL (解約手続きリンク) for all services
- 13 new category labels for subscription types
- GitHub Actions CI pipeline (lint → test → build)
- Test coverage: 14 test files, 120 tests
- Retry logic for model download script (Vercel reliability)
- ErrorBoundary component for React error handling

### Fixed
- TabNavigator not rendering on production (replaced `next/dynamic` with direct imports)
- 74 missing bidirectional overlap relationships in rules
- iOS Safari result page jumping back to upload
- Date extraction from 回払い lines
- Image resizing before OCR (max 1600px for iOS memory)

## [0.1.0] - 2026-03-22

### Added
- Initial release: OCR-based subscription analysis
- PaddleOCR v5 via ONNX Runtime WebAssembly (browser-side)
- 36 subscription service rules with overlap detection
- Apple tax detection (App Store vs official pricing)
- Health score report (0-100) with share card generation
- Demo mode with preloaded data
- SEO meta tags, PWA manifest, app icons
- Sentry error monitoring integration
- Rate limiting (30 scans/hour)
- Privacy policy and disclaimer pages
