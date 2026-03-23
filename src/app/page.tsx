"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { recognizeImage } from "@/lib/ocr";
import type { OcrResult } from "@/lib/ocr";
import { parseTransactions } from "@/lib/parser";
import type { ParsedTransaction } from "@/lib/parser";
import { matchTransactions, detectOverlaps } from "@/lib/matcher";
import { generateReport } from "@/lib/report";
import type { Report } from "@/lib/report";
import { generateShareCard } from "@/lib/report/share";
import { generateDemoResult } from "@/lib/demo";
import { checkRateLimit, recordScan } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import {
  ScoreCard,
  SummaryCard,
  FeedbackSection,
  FeatureCard,
  SubscriptionList,
  UnmatchedTransactions,
} from "@/components";

type Step = "upload" | "processing" | "result";

// Persist/restore result via sessionStorage to survive iOS Safari page reloads
const SESSION_KEY = "subsc-doctor-result";

function saveResult(data: {
  ocrResult: OcrResult;
  transactions: ParsedTransaction[];
  report: Report;
}) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function loadResult(): {
  ocrResult: OcrResult;
  transactions: ParsedTransaction[];
  report: Report;
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function clearResult() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export default function HomePage() {
  // Restore from sessionStorage if iOS Safari reloaded the page
  const restored = typeof window !== "undefined" ? loadResult() : null;

  const [step, setStep] = useState<Step>(restored ? "result" : "upload");
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(restored?.ocrResult ?? null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>(restored?.transactions ?? []);
  const [report, setReport] = useState<Report | null>(restored?.report ?? null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageUrlRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  // Track page view once
  useEffect(() => {
    trackEvent("page_view");
  }, []);

  const processImages = useCallback(
    async (files: File[]) => {
      // Prevent double-processing (iOS Safari can fire onChange twice)
      if (processingRef.current) return;
      processingRef.current = true;

      // Rate limit check
      const limit = checkRateLimit();
      if (!limit.allowed) {
        const mins = Math.ceil(limit.retryAfterMs / 60000);
        setStatus(`利用制限に達しました。${mins}分後にお試しください。`);
        processingRef.current = false;
        return;
      }

      trackEvent("upload_start", { imageCount: files.length });
      setStep("processing");
      setError(null);
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      const newUrl = URL.createObjectURL(files[0]);
      imageUrlRef.current = newUrl;
      setImageUrl(newUrl);

      try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not available");

        // OCR each image and merge results
        const allOcrResults: OcrResult[] = [];
        for (let i = 0; i < files.length; i++) {
          setStatus(`OCR 処理中... (${i + 1}/${files.length})`);
          const ocr = await recognizeImage(files[i], canvas, setStatus);
          allOcrResults.push(ocr);
        }

        // Merge OCR results
        const mergedOcr: OcrResult = {
          text: allOcrResults.map((o) => o.text).join("\n"),
          lines: allOcrResults.flatMap((o) => o.lines),
          duration: allOcrResults.reduce((sum, o) => sum + o.duration, 0),
          avgConfidence:
            allOcrResults.reduce((sum, o) => sum + o.avgConfidence * o.lines.length, 0) /
            Math.max(1, allOcrResults.reduce((sum, o) => sum + o.lines.length, 0)),
        };
        setOcrResult(mergedOcr);
        trackEvent("ocr_complete", { lines: mergedOcr.lines.length, duration: mergedOcr.duration });

        // Step 2: Parse transactions
        setStatus("テキスト構造化中...");
        const txs = parseTransactions(mergedOcr.text);
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
        trackEvent("result_view", { matched: rpt.matchedCount, score: rpt.score });
        // Persist result so iOS Safari page reloads can restore it
        saveResult({ ocrResult: mergedOcr, transactions: txs, report: rpt });
        setStatus("");
        setStep("result");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus("");
        // Stay on result page if we already have results, otherwise show error on upload page
        if (!report) {
          setStep("upload");
        }
      } finally {
        processingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      processImages(files);
    },
    [processImages]
  );

  const reset = useCallback(() => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = null;
    setImageUrl(null);
    setOcrResult(null);
    setTransactions([]);
    setReport(null);
    setIsDemo(false);
    setError(null);
    setStep("upload");
    setStatus("");
    clearResult();
  }, []);

  const runDemo = useCallback(() => {
    const demo = generateDemoResult();
    setOcrResult(demo.ocrResult);
    setTransactions(demo.transactions);
    setReport(demo.report);
    setIsDemo(true);
    setStep("result");
    trackEvent("demo_click");
  }, []);

  const handleShare = useCallback(async () => {
    if (!report) return;
    trackEvent("share_click");
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
          <div className="mt-6 space-y-6">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-lg font-medium mb-2">
                クレジットカード明細のスクリーンショットをアップロード
              </p>
              <p className="text-sm text-gray-500 mb-4">
                JPG / PNG 対応・複数枚同時アップロード可 — データはブラウザ内で処理され、サーバーに送信されません
              </p>
              <label
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg text-lg cursor-pointer hover:bg-blue-700 active:bg-blue-800"
                style={{ WebkitAppearance: "none", touchAction: "manipulation" }}
              >
                画像を選択
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={runDemo}
                  className="text-sm text-blue-600 underline hover:text-blue-800"
                  style={{ touchAction: "manipulation" }}
                >
                  デモで試してみる
                </button>
              </div>
            </div>
            {(status || error) && (
              <p className="text-red-600 text-sm text-center">{error || status}</p>
            )}

            {/* Value Proposition */}
            <div className="grid grid-cols-1 gap-3">
              <FeatureCard
                title="Apple税を発見"
                description="App Store経由で割高になっているサブスクを検出。公式サイトとの価格差を表示します。"
                color="red"
              />
              <FeatureCard
                title="重複サブスクを検出"
                description="SpotifyとYouTube Premiumなど、似たサービスの重複利用を見つけます。"
                color="amber"
              />
              <FeatureCard
                title="36種類のサービスに対応"
                description="Netflix, Spotify, iCloud, NURO光, ChatGPT, Adobe CC など主要サービスを自動識別。"
                color="blue"
              />
            </div>

            {/* FAQ */}
            <section>
              <h2 className="font-bold text-lg mb-3">よくある質問</h2>
              <div className="space-y-3">
                <FaqItem
                  q="データは安全ですか？"
                  a="はい。画像の解析はすべてブラウザ内で完結します。サーバーへのアップロードは一切ありません。通信が発生しないため、個人情報が外部に漏れるリスクはゼロです。"
                />
                <FaqItem
                  q="Apple税とは何ですか？"
                  a="App Store経由でサブスクに加入すると、Appleの手数料（15〜30%）が上乗せされた価格になります。公式サイトから直接契約すれば、同じサービスをより安く利用できます。"
                />
                <FaqItem
                  q="どのカード会社に対応していますか？"
                  a="楽天カード・三井住友カード・JCBなど主要カード明細に対応。それ以外のカードでも、スクリーンショットから読み取れる形式であれば診断可能です。"
                />
                <FaqItem
                  q="対応しているサブスクは？"
                  a="Netflix, Spotify, YouTube Premium, iCloud, Apple Music, Amazon Prime, ChatGPT Plus, Adobe CC, NURO光 など36種類以上のサービスを自動識別します。"
                />
                <FaqItem
                  q="無料で使えますか？"
                  a="はい、完全無料です。アカウント登録も不要で、すぐにご利用いただけます。"
                />
              </div>
            </section>

            {/* Privacy Note */}
            <div className="text-center text-xs text-gray-400 space-y-1">
              <p>OCR処理はすべてブラウザ内で完結。画像はサーバーに送信されません。</p>
              <p>対応カード：楽天カード・三井住友・JCB・その他の明細スクリーンショット</p>
            </div>
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

            <ScoreCard report={report} />

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

            <SubscriptionList report={report} />
            <UnmatchedTransactions report={report} />

            {/* OCR Details */}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                OCR 詳細（{ocrResult?.lines.length}行 / {ocrResult?.duration}ms / 信頼度{((ocrResult?.avgConfidence ?? 0) * 100).toFixed(0)}%）
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {ocrResult?.text.split("\n").map((line, i) => `${String(i + 1).padStart(3)}| ${line}`).join("\n")}
              </pre>
              <div className="mt-2">
                <strong>構造化結果 ({transactions.length}件):</strong>
                <pre className="p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(transactions, null, 2)}
                </pre>
              </div>
            </details>

            <FeedbackSection />

            <p className="text-xs text-gray-400 text-center">
              ※ 本サービスの提案は参考情報です。契約変更・解約は自己責任でお願いします。
            </p>

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

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer font-medium text-sm text-gray-700 hover:text-gray-900">
        {q}
      </summary>
      <p className="mt-1 text-sm text-gray-500 pl-4">{a}</p>
    </details>
  );
}
