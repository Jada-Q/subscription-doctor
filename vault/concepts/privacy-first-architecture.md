Privacy-first architecture is Subscription Doctor's core design principle: all data processing happens in the user's browser, and no user data is sent to any server.

## Design Decisions

- **OCR**: Runs in-browser via PaddleOCR + ONNX Runtime WebAssembly
- **Rule matching**: Local JSON file, no server calls
- **Image handling**: Compressed and processed client-side; never uploaded
- **State persistence**: sessionStorage / IndexedDB (local only)
- **AI fallback (v1.1)**: Only sanitized, de-identified text sent to Gemini; explicit user consent required

## Tagline

> "あなたのデータは、あなたのデバイスから出ません。"
> (Your data never leaves your device.)

## Competitive Advantage

| Product                 | Approach                  | Privacy                                  |
| ----------------------- | ------------------------- | ---------------------------------------- |
| [[rocket-money]]        | Bank API connection       | User credentials shared with third party |
| [[trim]]                | Bank API connection       | User credentials shared with third party |
| [[subsHub]]             | Manual entry              | Good privacy, but weak features          |
| **Subscription Doctor** | Local OCR + rule matching | Strong privacy AND strong features       |

This is especially important in Japan, where users are reluctant to share banking credentials with third-party services. The PROJECT_PLAN notes "user reluctance to upload screenshots" as a medium-probability risk -- the privacy-first design directly mitigates this.

## PIPA Compliance

The architecture simplifies [[japan-privacy-law]] compliance because minimal personal data is collected. The main compliance surface is the v1.1 user feedback feature, which requires an independent consent dialog.

## Related

- [[japan-privacy-law]] -- Regulatory framework this architecture supports
- [[ocr-engine-selection]] -- PaddleOCR chosen partly for client-side capability
