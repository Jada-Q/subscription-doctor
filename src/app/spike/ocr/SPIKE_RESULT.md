# OCR Spike Result — 2026-03-23

## Test Setup
- **Libraries**: paddleocr 1.1.1 + onnxruntime-web 1.24.3 / tesseract.js 7.0.0
- **Models**: PP-OCRv5_mobile_det (4.6MB) + PP-OCRv5_mobile_rec (16MB) + ppocrv5_dict (72KB)

## Results

### Desktop (M4 Pro Mac, Chrome)

| Metric | PaddleOCR v5 | Tesseract.js v7 |
|--------|-------------|-----------------|
| Speed (demo) | 1.9s | 1.9s |
| Confidence | 96.2% | 79.0% |
| Lines detected | 37 | 14 |
| Japanese text | Perfect | Extra spaces |
| Date parsing | Correct (01/15) | Merged (01715) |
| Amount (¥) | Correct (¥1,300) | Wrong (\t.300) |
| Service names | No spaces (APPLECOMBILL) | Correct (APPLE COM BILL) |

### iPhone Safari (iOS, production build)

| Metric | PaddleOCR v5 | Tesseract.js v7 |
|--------|-------------|-----------------|
| Speed (demo 800x600) | **1.3s** | 10.7s |
| Speed (real photo 1170x2222) | **2.9s** | 2.9s |
| Confidence (demo) | 96.2% | 79.0% |
| Lines detected (demo) | 37 | 14 |
| WASM loading | OK (numThreads: 1) | OK |
| Crashes | None | None |

## Decision

### PaddleOCR v5 を唯一のエンジンとして採用

**FATAL-2 覆りました**: PaddleOCR (onnxruntime-web) は iOS Safari で正常動作。
双引擎は不要 → PaddleOCR 一本化。

理由:
1. iOS Safari で 1.3-2.9秒（目標 <6秒を大幅クリア）
2. Tesseract は iPhone で 10.7秒 → 実用不可
3. Tesseract は ¥ 記号を誤認識 → 金融データで致命的
4. PaddleOCR の日本語精度が圧倒的に高い

### Tesseract.js は削除
- iPhone でも PaddleOCR が動作するため、フォールバックは不要
- 依存パッケージを減らす

## Key Findings

1. **辞書の空行が重要**: `ppocrv5_dict.txt` の1行目は空行（CTC blank token）。filter で除外すると文字化け。
2. **WASM 設定**: `ort.env.wasm.numThreads = 1` + WASM ファイルを public/ にコピー。
3. **PP-OCRv5 辞書は日本語対応済み**: ひらがな86 + カタカナ94 + 漢字15,565。追加モデル不要。
4. **Next.js 16 Turbopack dev モードは iOS Safari 非対応**: production ビルド (`next build && next start`) でテストする必要あり。
5. **サービス名スペース消失**: `APPLECOMBILL` → 規則库の部分一致キーワードで対処可能。

## Remaining Tests
- [ ] Real credit card statement screenshots (楽天/SMBC/JCB)
- [ ] HEIC upload test
- [x] ~~iPhone Safari test~~ ✅ PaddleOCR 正常動作
