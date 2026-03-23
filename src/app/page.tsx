"use client";

import { useState, useRef, useCallback } from "react";
import { recognizeImage } from "@/lib/ocr";
import type { OcrResult } from "@/lib/ocr";
import { parseTransactions } from "@/lib/parser";
import type { ParsedTransaction } from "@/lib/parser";
import { matchTransactions, detectOverlaps } from "@/lib/matcher";
import type { MatchedTransaction } from "@/lib/matcher";
import { generateReport, gradeLabel } from "@/lib/report";
import type { Report } from "@/lib/report";
import { generateShareCard } from "@/lib/report/share";
import { generateDemoResult } from "@/lib/demo";
import { checkRateLimit, recordScan } from "@/lib/rate-limit";

type Step = "upload" | "processing" | "result";

export default function HomePage() {
  const [step, setStep] = useState<Step>("upload");
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      // Rate limit check
      const limit = checkRateLimit();
      if (!limit.allowed) {
        const mins = Math.ceil(limit.retryAfterMs / 60000);
        setStatus(`利用制限に達しました。${mins}分後にお試しください。`);
        return;
      }

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

        // Step 4: Detect overlaps
        const overlapGroups = detectOverlaps(matchedTxs);

        // Step 5: Generate report
        setStatus("レポート生成中...");
        const rpt = generateReport(matchedTxs, overlapGroups);
        setReport(rpt);

        recordScan();
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
    setReport(null);
    setIsDemo(false);
    setStep("upload");
    setStatus("");
  }, [imageUrl]);

  const runDemo = useCallback(() => {
    const demo = generateDemoResult();
    setOcrResult(demo.ocrResult);
    setTransactions(demo.transactions);
    setReport(demo.report);
    setIsDemo(true);
    setStep("result");
  }, []);

  const handleShare = useCallback(async () => {
    if (!report) return;
    const dataUrl = generateShareCard(report);

    // Try native share (mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await fetch(dataUrl).then((r) => r.blob());
        const file = new File([blob], "subscription-doctor.png", {
          type: "image/png",
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "サブスク診断結果",
            files: [file],
          });
          return;
        }
      } catch {
        // Fall through to download
      }
    }

    // Fallback: download
    const link = document.createElement("a");
    link.download = "subscription-doctor.png";
    link.href = dataUrl;
    link.click();
  }, [report]);

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
              <label
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg text-lg cursor-pointer hover:bg-blue-700 active:bg-blue-800"
                style={{ WebkitAppearance: "none", touchAction: "manipulation" }}
              >
                画像を選択
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={runDemo}
              className="mt-4 text-sm text-blue-600 underline hover:text-blue-800"
              style={{ touchAction: "manipulation" }}
            >
              デモで試してみる
            </button>
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

        {step === "result" && report && (
          <div className="mt-4 space-y-6">
            {/* Demo Banner */}
            {isDemo && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm text-blue-800">
                これはデモデータです。実際の明細をアップロードして診断してみましょう。
              </div>
            )}

            {/* Score */}
            <ScoreCard report={report} />

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard
                label="月額合計"
                value={`¥${report.totalMonthly.toLocaleString()}`}
              />
              <SummaryCard
                label="Apple税"
                value={`¥${report.appleTaxTotal.toLocaleString()}`}
                highlight={report.appleTaxTotal > 0}
              />
              <SummaryCard
                label="検出サービス"
                value={`${report.matchedCount}件`}
              />
            </div>

            {/* Savings */}
            {report.savingsAnnual > 0 && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100">
                <div className="text-center">
                  <div className="text-sm text-gray-600">年間節約可能額</div>
                  <div className="text-3xl font-bold text-red-600 mt-1">
                    ¥{report.savingsAnnual.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    (月額 ¥{report.savingsMonthly.toLocaleString()})
                  </div>
                </div>
              </div>
            )}

            {/* Apple Tax */}
            {report.appleTaxItems.length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-2 text-red-600">
                  Apple税が検出されました
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  App Store 経由の課金は公式サイトより割高です。公式サイトから直接契約すると節約できます。
                </p>
                {report.appleTaxItems.map((item, i) => (
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
              </section>
            )}

            {/* Overlaps */}
            {report.overlaps.length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-2 text-amber-600">
                  重複サブスクリプション
                </h2>
                {report.overlaps.map((group, i) => (
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

            {/* Matched Subscriptions */}
            {report.allTransactions.filter((m) => m.matchedService).length > 0 && (
              <section>
                <h2 className="font-bold text-lg mb-2">検出されたサブスク</h2>
                <div className="space-y-2">
                  {report.allTransactions
                    .filter((m) => m.matchedService)
                    .map((item: MatchedTransaction, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{item.matchedService}</div>
                          <div className="text-xs text-gray-500">
                            {item.date} ・{" "}
                            <span className="text-green-600">
                              {item.matchType === "keyword_exact" ? "完全一致" : "部分一致"}
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
            )}

            {/* Unmatched Transactions */}
            {report.allTransactions.filter((m) => !m.matchedService).length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                  その他の取引（{report.allTransactions.filter((m) => !m.matchedService).length}件）
                </summary>
                <div className="mt-2 space-y-1">
                  {report.allTransactions
                    .filter((m) => !m.matchedService)
                    .map((item: MatchedTransaction, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-2 text-gray-500"
                      >
                        <div>
                          <span>{item.description}</span>
                          <span className="text-xs ml-2">{item.date}</span>
                        </div>
                        <span>¥{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </details>
            )}

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

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleShare}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800"
                style={{ touchAction: "manipulation" }}
              >
                結果を共有する
              </button>
              <button
                type="button"
                onClick={reset}
                className="w-full py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                style={{ touchAction: "manipulation" }}
              >
                もう一度診断する
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t px-4 py-3 text-center text-xs text-gray-400">
        <a href="/privacy" className="hover:text-gray-600 underline">
          プライバシーポリシー
        </a>
        <span className="mx-2">・</span>
        データはブラウザ内で処理され、サーバーに送信されません
      </footer>
    </div>
  );
}

function ScoreCard({ report }: { report: Report }) {
  const gradeColors = {
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-600", ring: "stroke-green-500" },
    yellow: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-600", ring: "stroke-yellow-500" },
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", ring: "stroke-red-500" },
  };
  const colors = gradeColors[report.grade];
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (report.score / 100) * circumference;

  return (
    <div className={`p-6 rounded-xl border ${colors.bg} ${colors.border} text-center`}>
      <div className="inline-block relative">
        <svg width="120" height="120" className="-rotate-90">
          <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="45" fill="none"
            className={colors.ring}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colors.text}`}>{report.score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <div className={`mt-2 text-lg font-bold ${colors.text}`}>
        {gradeLabel(report.grade)}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {report.totalCount}件のサブスクを検出（{report.matchedCount}件識別済み）
      </div>
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
