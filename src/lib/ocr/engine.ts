import type { OcrResult } from "./types";

let cachedService: Awaited<ReturnType<typeof createService>> | null = null;

async function createService() {
  const ort = await import("onnxruntime-web");
  ort.env.wasm.wasmPaths = "/models/";
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;

  const { PaddleOcrService } = await import("paddleocr");

  const [detBuf, recBuf, dictText] = await Promise.all([
    fetch("/models/PP-OCRv5_mobile_det_infer.onnx").then((r) => r.arrayBuffer()),
    fetch("/models/PP-OCRv5_mobile_rec_infer.onnx").then((r) => r.arrayBuffer()),
    fetch("/models/ppocrv5_dict.txt").then((r) => r.text()),
  ]);

  // First line is empty (CTC blank token) — do NOT filter
  const dict = dictText.split("\n");
  if (dict[dict.length - 1] === "") dict.pop();

  const service = await PaddleOcrService.createInstance({
    ort,
    detection: { modelBuffer: detBuf },
    recognition: {
      modelBuffer: recBuf,
      charactersDictionary: dict,
      imageHeight: 48,
    },
  });

  return service;
}

/**
 * Get or create the PaddleOCR service singleton.
 * Models are cached after first load.
 */
export async function getOcrService() {
  if (!cachedService) {
    cachedService = await createService();
  }
  return cachedService;
}

/**
 * Max dimension for OCR input. Images larger than this are scaled down
 * to reduce memory usage (critical for iOS Safari) and speed up OCR.
 * 1600px is enough for credit card statement text to remain readable.
 */
const MAX_DIMENSION = 1600;

/**
 * Extract pixel data from a File via canvas, resizing large images.
 */
export function fileToImageInput(
  file: File,
  canvas: HTMLCanvasElement
): Promise<{ width: number; height: number; data: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => {
      // Scale down if larger than MAX_DIMENSION
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context not available"));
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      resolve({
        width,
        height,
        data: new Uint8Array(imageData.data.buffer),
      });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Run OCR on a File and return structured results.
 */
export async function recognizeImage(
  file: File,
  canvas: HTMLCanvasElement,
  onStatus?: (msg: string) => void
): Promise<OcrResult> {
  const start = performance.now();

  onStatus?.("モデル読み込み中...");
  const service = await getOcrService();

  onStatus?.("画像処理中...");
  const imageInput = await fileToImageInput(file, canvas);

  onStatus?.("OCR 実行中...");
  const results = await service.recognize(imageInput);
  const processed = service.processRecognition(results);

  const duration = Math.round(performance.now() - start);
  const lines = results.map((r) => ({
    text: r.text,
    confidence: r.confidence,
  }));
  const avgConfidence =
    lines.length > 0
      ? lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length
      : 0;

  return { text: processed.text, lines, duration, avgConfidence };
}
