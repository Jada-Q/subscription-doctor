OCR engine selection was the highest-priority technical risk (FATAL-1/FATAL-2) for Subscription Doctor, resolved via a W1 spike test on 2026-03-23.

## Spike Results

| Engine           | Confidence | Speed    | Japanese     | Date/Amount                      | Notes           |
| ---------------- | ---------- | -------- | ------------ | -------------------------------- | --------------- |
| **PaddleOCR v5** | **96.2%**  | **1.9s** | Correct      | Correct                          | Selected engine |
| Tesseract.js v7  | 79.0%      | 1.9s     | Extra spaces | Merged dates, misread yen symbol | Rejected        |

## Decision: PaddleOCR Only

The spike conclusively showed PaddleOCR v5 outperforms Tesseract.js on Japanese credit card statements. Key findings:

- **Desktop (Chrome)**: PaddleOCR 96.2% vs Tesseract 79.0%
- **iPhone Safari**: PaddleOCR works with `numThreads: 1` + WASM backend (1.3s demo, 2.9s real photo). Tesseract.js took 10.7s -- unusable.
- **Original plan was dual-engine** (PaddleOCR desktop + Tesseract mobile) but iPhone performance eliminated the need

## Technical Details

- Package: `paddleocr` 1.1.1 (npm, by X3ZvaWQ) + PP-OCRv5 models
- Runtime: ONNX Runtime WebAssembly (browser-side)
- iOS constraint: `numThreads = 1` to prevent WASM crashes
- Image scaling: max 1600px for mobile memory limits
- Dictionary: `ppocrv5_dict.txt` line 1 is empty (CTC blank token) -- must not be filtered
- `client-side-ocr` was evaluated and rejected (full app with React/Mantine deps, not a library)

## Related

- [[privacy-first-architecture]] -- Client-side OCR is central to the privacy model
- [[wallos]] -- Manual entry; OCR automation is the key advantage
- [[subsHub]] -- Also manual entry; no OCR capability
