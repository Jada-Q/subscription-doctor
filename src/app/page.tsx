"use client";

import { useState, useRef, useCallback } from "react";
import { recognizeImage } from "@/lib/ocr";
import type { OcrResult } from "@/lib/ocr";
import { parseTransactions } from "@/lib/parser";
import type { ParsedTransaction } from "@/lib/parser";
import { matchTransactions, detectOverlaps } from "@/lib/matcher";
import type { MatchedTransaction } from "@/lib/matcher";

type Step = "upload" | "processing" | "result";

export default function HomePage() {
  const [step, setStep] = useState<Step>("upload");
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [matched, setMatched] = useState<MatchedTransaction[]>([]);
  const [overlaps, setOverlaps] = useState<MatchedTransaction[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      setStep("processing");
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(file));

      try {
        // Step 1: OCR
        setStatus("OCR 処理中...");
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not available");
        const ocr = await recognizeImage(file, canvas, setStatus);
        setOcrResult(ocr);

        // Step 2: Parse transactions
        setStatus("テキスト構造化中...");
        const txs = parseTransactions(ocr.text);
        setTransactions(txs);

        // Step 3: Match against rules
        setStatus("サービス照合中...");
        const matchedTxs = matchTransactions(txs);
        setMatched(matchedTxs);

        // Step 4: Detect overlaps
        const overlapGroups = detectOverlaps(matchedTxs);
        setOverlaps(overlapGroups);

        setStatus("");
        setStep("result");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`エラー: ${msg}`);
        setStep("upload");
      }
    },
    [imageUrl]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const reset = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setOcrResult(null);
    setTransactions([]);
    setMatched([]);
    setOverlaps([]);
    setStep("upload");
    setStatus("");
  }, [imageUrl]);

  const appleTaxItems = matched.filter((m) => m.appleTaxAmount > 0);
  const totalMonthly = matched.reduce((sum, m) => sum + m.amount, 0);
  const totalAppleTax = appleTaxItems.reduce((sum, m) => sum + m.appleTaxAmount, 0);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">サブスク診断</h1>
        <p className="text-sm text-gray-500">
          クレジットカード明細からサブスクの無駄を見つけます
        </p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4">
        <canvas ref={canvasRef} className="hidden" />

        {step === "upload" && (
          <div className="mt-8 text-center">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8">
              <p className="text-lg font-medium mb-2">
                クレジットカード明細のスクリーンショットをアップロード
              </p>
              <p className="text-sm text-gray-500 mb-4">
                JPG / PNG 対応 — データはブラウザ内で処理され、サーバーに送信されません
              </p>
              <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg text-lg cursor-pointer hover:bg-blue-700 active:bg-blue-800"
                style={{ WebkitAppearance: "none", touchAction: "manipulation" }}>
                画像を選択
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {status && (
              <p className="mt-4 text-red-600 text-sm">{status}</p>
            )}
          </div>
        )}

        {step === "processing" && (
          <div className="mt-8 text-center">
            <div className="animate-pulse text-lg font-medium">
              {status || "処理中..."}
            </div>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Processing"
                className="mt-4 max-h-48 mx-auto rounded-lg border opacity-50"
              />
            )}
          </div>
        )}

        {step === "result" && (
          <div className="mt-4 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard
                label="月額合計"
                value={`¥${totalMonthly.toLocaleString()}`}
              />
              <SummaryCard
                label="Apple税"
                value={`¥${totalAppleTax.toLocaleString()}`}
                highlight={totalAppleTax > 0}
              />
              <SummaryCard
                label="検出サービス"
                value={`${matched.filter((m) => m.matchedService).length}件`}
              />
            </div>

            {/* Apple Tax */}
            {appleTaxItems.length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-2 text-red-600">
                  Apple税が検出されました
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  App Store 経由の課金は公式サイトより割高です。公式サイトから直接契約すると節約できます。
                </p>
                {appleTaxItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 bg-red-50 rounded-lg mb-2"
                  >
                    <div>
                      <div className="font-medium">{item.matchedService}</div>
                      <div className="text-xs text-gray-500">
                        App Store ¥{item.matchedRule?.appStorePrice.toLocaleString()} →
                        公式 ¥{item.matchedRule?.officialPrice.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-red-600 font-bold">
                      -¥{item.appleTaxAmount.toLocaleString()}/月
                    </div>
                  </div>
                ))}
                <div className="text-right font-bold text-red-600">
                  年間節約可能額: ¥{(totalAppleTax * 12).toLocaleString()}
                </div>
              </section>
            )}

            {/* Overlaps */}
            {overlaps.length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-2 text-amber-600">
                  重複サブスクリプション
                </h2>
                {overlaps.map((group, i) => (
                  <div
                    key={i}
                    className="p-3 bg-amber-50 rounded-lg mb-2"
                  >
                    <div className="text-sm font-medium text-amber-800">
                      類似サービスが複数あります:
                    </div>
                    {group.map((item, j) => (
                      <div key={j} className="flex justify-between mt-1">
                        <span>{item.matchedService}</span>
                        <span className="font-medium">
                          ¥{item.amount.toLocaleString()}/月
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )}

            {/* All Matched Transactions */}
            <section>
              <h2 className="font-bold text-lg mb-2">検出されたサブスク</h2>
              <div className="space-y-2">
                {matched.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {item.matchedService || item.description}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.date} ・{" "}
                        <span
                          className={
                            item.matchType === "unmatched"
                              ? "text-gray-400"
                              : "text-green-600"
                          }
                        >
                          {item.matchType === "unmatched"
                            ? "未識別"
                            : item.matchType === "keyword_exact"
                              ? "完全一致"
                              : "部分一致"}
                        </span>
                      </div>
                    </div>
                    <div className="font-medium">
                      ¥{item.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* OCR Details */}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                OCR 詳細（{ocrResult?.lines.length}行 / {ocrResult?.duration}ms / 信頼度{((ocrResult?.avgConfidence ?? 0) * 100).toFixed(0)}%）
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {ocrResult?.text}
              </pre>
              <div className="mt-2">
                <strong>構造化結果 ({transactions.length}件):</strong>
                <pre className="p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(transactions, null, 2)}
                </pre>
              </div>
            </details>

            <button
              type="button"
              onClick={reset}
              className="w-full py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              style={{ touchAction: "manipulation" }}
            >
              もう一度診断する
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg text-center ${highlight ? "bg-red-50" : "bg-gray-50"}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`text-lg font-bold ${highlight ? "text-red-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
