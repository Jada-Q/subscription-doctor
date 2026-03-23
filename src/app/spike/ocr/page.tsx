"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface OcrResult {
  text: string;
  lines: { text: string; confidence: number }[];
  duration: number;
  avgConfidence: number;
  error?: string;
}

export default function OcrSpikePage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("画像をアップロードしてください");
  const [logs, setLogs] = useState<string[]>([]);
  const [ua, setUa] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `${ts} ${msg}`]);
  }, []);

  useEffect(() => {
    setUa(navigator.userAgent);
    log("ページ読み込み完了");
  }, [log]);

  const getImageData = useCallback(
    (file: File): Promise<{ width: number; height: number; data: Uint8Array }> => {
      return new Promise((resolve, reject) => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return reject(new Error("Canvas not found"));
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Context not found"));
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          resolve({
            width: img.width,
            height: img.height,
            data: new Uint8Array(imageData.data.buffer),
          });
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = URL.createObjectURL(file);
      });
    },
    []
  );

  const runOcr = useCallback(
    async (file: File) => {
      setLoading(true);
      setResult(null);
      setStatus("PaddleOCR: モデル読み込み中...");
      log("PaddleOCR: 開始");

      try {
        const start = performance.now();

        const ort = await import("onnxruntime-web");
        ort.env.wasm.wasmPaths = "/models/";
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
        log("onnxruntime-web OK");

        const { PaddleOcrService } = await import("paddleocr");
        log("paddleocr OK");

        setStatus("PaddleOCR: モデルダウンロード中...");
        const [detBuf, recBuf, dictText] = await Promise.all([
          fetch("/models/PP-OCRv5_mobile_det_infer.onnx").then((r) => r.arrayBuffer()),
          fetch("/models/PP-OCRv5_mobile_rec_infer.onnx").then((r) => r.arrayBuffer()),
          fetch("/models/ppocrv5_dict.txt").then((r) => r.text()),
        ]);
        log(`モデル取得完了 det=${detBuf.byteLength} rec=${recBuf.byteLength}`);

        const dict = dictText.split("\n");
        if (dict[dict.length - 1] === "") dict.pop();

        setStatus("PaddleOCR: エンジン初期化中...");
        const service = await PaddleOcrService.createInstance({
          ort,
          detection: { modelBuffer: detBuf },
          recognition: {
            modelBuffer: recBuf,
            charactersDictionary: dict,
            imageHeight: 48,
          },
        });
        log("エンジン初期化OK");

        setStatus("PaddleOCR: 画像処理中...");
        const imageInput = await getImageData(file);
        log(`画像 ${imageInput.width}x${imageInput.height}`);

        setStatus("PaddleOCR: OCR 実行中...");
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

        setResult({ text: processed.text, lines, duration, avgConfidence });
        log(`完了 ${duration}ms ${lines.length}行`);
        setStatus("PaddleOCR: 完了");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setResult({ text: "", lines: [], duration: 0, avgConfidence: 0, error: msg });
        setStatus(`PaddleOCR エラー: ${msg}`);
        log(`エラー: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [getImageData, log]
  );

  const handleFile = useCallback(
    (file: File) => {
      log(`OCR開始: ${file.name} (${file.size} bytes)`);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(file));
      setResult(null);
      runOcr(file);
    },
    [imageUrl, runOcr, log]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const generateDemoImage = useCallback(async () => {
    log("デモ画像生成開始");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#333";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("楽天カード ご利用明細", 40, 50);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#666";
      ctx.fillText("2026年2月ご請求分", 40, 75);

      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(40, 100, 720, 30);
      ctx.fillStyle = "#333";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("ご利用日", 50, 120);
      ctx.fillText("ご利用先", 200, 120);
      ctx.fillText("金額（円）", 600, 120);

      const rows = [
        ["01/15", "APPLE COM BILL", "1,300"],
        ["01/15", "NETFLIX.COM", "1,590"],
        ["01/18", "SPOTIFY PREMIUM", "980"],
        ["01/20", "AMAZON PRIME会費", "600"],
        ["01/22", "APPLE COM BILL", "1,280"],
        ["01/25", "YOUTUBE PREMIUM", "1,280"],
        ["01/28", "CHATGPT SUBSCRIPTION", "2,800"],
        ["02/01", "ADOBE CREATIVE CLOUD", "6,480"],
        ["02/03", "MICROSOFT 365", "1,490"],
        ["02/05", "DISNEY PLUS", "990"],
      ];

      ctx.font = "14px sans-serif";
      rows.forEach((row, i) => {
        const y = 155 + i * 35;
        if (i % 2 === 0) {
          ctx.fillStyle = "#fafafa";
          ctx.fillRect(40, y - 15, 720, 35);
        }
        ctx.fillStyle = "#333";
        ctx.fillText(row[0], 50, y + 5);
        ctx.fillText(row[1], 200, y + 5);
        ctx.fillText("¥" + row[2], 620, y + 5);
      });

      const totalY = 155 + rows.length * 35 + 20;
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(40, totalY - 10, 720, 35);
      ctx.fillStyle = "#333";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("ご請求合計", 200, totalY + 12);
      ctx.fillText("¥18,790", 600, totalY + 12);

      const dataUrl = canvas.toDataURL("image/png");
      const byteString = atob(dataUrl.split(",")[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const file = new File([new Blob([ab], { type: "image/png" })], "demo.png", { type: "image/png" });
      log(`デモ画像生成成功: ${file.size} bytes`);
      handleFile(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`デモ画像エラー: ${msg}`);
    }
  }, [handleFile, log]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 8 }}>OCR Spike — PaddleOCR v5</h1>

      <div style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} style={{ fontSize: 16 }} />
        <button type="button" onClick={() => generateDemoImage()} disabled={loading}
          style={{ padding: "12px 24px", fontSize: 16, background: loading ? "#999" : "#0070f3", color: "#fff", border: "none", borderRadius: 8, WebkitAppearance: "none", touchAction: "manipulation" }}>
          デモ画像で実行
        </button>
      </div>

      <p style={{ padding: "8px 12px", background: "#f0f0f0", borderRadius: 6, fontSize: 14 }}>{status}</p>

      {imageUrl && (
        <div style={{ marginTop: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded" style={{ maxWidth: "100%", maxHeight: 400, border: "1px solid #ddd", borderRadius: 8 }} />
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {result && (
        <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          {result.error ? (
            <div style={{ background: "#fee", padding: 12, borderRadius: 6, color: "#c00", wordBreak: "break-all" }}>エラー: {result.error}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <Stat label="処理時間" value={`${(result.duration / 1000).toFixed(1)}秒`} />
                <Stat label="平均信頼度" value={`${(result.avgConfidence * 100).toFixed(1)}%`} />
                <Stat label="検出行数" value={`${result.lines.length}行`} />
              </div>
              <h3 style={{ fontWeight: "bold", marginBottom: 4, fontSize: 14 }}>認識テキスト:</h3>
              <pre style={{ background: "#f8f8f8", padding: 12, borderRadius: 6, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 300, overflow: "auto", lineHeight: 1.6 }}>
                {result.text || "(テキストなし)"}
              </pre>
              <h3 style={{ fontWeight: "bold", marginTop: 12, marginBottom: 4, fontSize: 14 }}>行別詳細:</h3>
              <div style={{ maxHeight: 200, overflow: "auto" }}>
                {result.lines.map((line, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee", fontSize: 13 }}>
                    <span>{line.text}</span>
                    <span style={{ color: line.confidence > 0.8 ? "#090" : line.confidence > 0.5 ? "#960" : "#c00", fontWeight: "bold", flexShrink: 0, marginLeft: 8 }}>
                      {(line.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 6, fontSize: 12 }}>
        <strong>Debug Log:</strong>
        <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {logs.length > 0 ? logs.join("\n") : "(待機中...)"}
        </pre>
      </div>
      {ua && <p style={{ marginTop: 8, fontSize: 11, color: "#999", wordBreak: "break-all" }}>UA: {ua}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f0f8ff", padding: 8, borderRadius: 6, textAlign: "center", minWidth: 100 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
