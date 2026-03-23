import type { ParsedTransaction } from "../parser/types";
import { matchTransactions, detectOverlaps } from "../matcher";
import { generateReport } from "../report";
import type { Report } from "../report";
import type { OcrResult } from "../ocr/types";

/**
 * Demo transactions simulating a typical Japanese user's credit card statement.
 * Shows: Apple tax (Spotify/Netflix via App Store), overlap (Spotify + YouTube Premium),
 * ISP detection (NURO光), and non-subscription items collapsed separately.
 */
const DEMO_TRANSACTIONS: ParsedTransaction[] = [
  {
    date: "02/15",
    description: "APPLE COM BILL",
    amount: 1300,
    rawLine: "02/15 APPLE COM BILL ¥1,300",
    isLikelySubscription: true,
  },
  {
    date: "02/15",
    description: "SPOTIFY",
    amount: 1280,
    rawLine: "02/15 SPOTIFY PREMIUM ¥1,280",
    isLikelySubscription: true,
  },
  {
    date: "02/18",
    description: "NETFLIX",
    amount: 1590,
    rawLine: "02/18 NETFLIX.COM ¥1,590",
    isLikelySubscription: true,
  },
  {
    date: "02/20",
    description: "YOUTUBE PREMIUM",
    amount: 1550,
    rawLine: "02/20 GOOGLE YOUTUBE PREMIUM ¥1,550",
    isLikelySubscription: true,
  },
  {
    date: "02/22",
    description: "CHATGPT",
    amount: 3000,
    rawLine: "02/22 CHATGPT SUBSCRIPTION ¥3,000",
    isLikelySubscription: true,
  },
  {
    date: "02/25",
    description: "AMAZON PRIME",
    amount: 600,
    rawLine: "02/25 AMAZON PRIME ¥600",
    isLikelySubscription: true,
  },
  {
    date: "02/10",
    description: "NURO光ご利用料金",
    amount: 5200,
    rawLine: "02/10 NURO光ご利用料金 5,200",
    isLikelySubscription: true,
  },
  {
    date: "02/12",
    description: "セブンイレブン赤坂店",
    amount: 850,
    rawLine: "02/12 セブンイレブン赤坂店 850",
    isLikelySubscription: false,
  },
  {
    date: "02/19",
    description: "スターバックス渋谷店",
    amount: 660,
    rawLine: "02/19 スターバックス渋谷店 660",
    isLikelySubscription: false,
  },
];

const DEMO_OCR_TEXT = DEMO_TRANSACTIONS.map((t) => t.rawLine).join("\n");

export interface DemoResult {
  report: Report;
  transactions: ParsedTransaction[];
  ocrResult: OcrResult;
}

export function generateDemoResult(): DemoResult {
  const matched = matchTransactions(DEMO_TRANSACTIONS);
  const overlaps = detectOverlaps(matched);
  const report = generateReport(matched, overlaps);

  const ocrResult: OcrResult = {
    text: DEMO_OCR_TEXT,
    lines: DEMO_TRANSACTIONS.map((t) => ({
      text: t.rawLine,
      confidence: 0.95,
    })),
    duration: 0,
    avgConfidence: 0.95,
  };

  return { report, transactions: DEMO_TRANSACTIONS, ocrResult };
}
