import type { ParsedTransaction } from "../parser/types";
import type { MatchedTransaction } from "../matcher/types";
import { matchTransactions, detectOverlaps } from "../matcher";
import { generateReport } from "../report";
import type { Report } from "../report";
import type { OcrResult } from "../ocr/types";

/**
 * Demo transactions simulating a typical Japanese user's credit card statement.
 * Includes: Apple tax (Spotify via App Store), overlap (Spotify + YouTube Premium),
 * and several common subscriptions.
 */
const DEMO_TRANSACTIONS: ParsedTransaction[] = [
  {
    date: "02/15",
    description: "APPLE COM BILL",
    amount: 1300,
    rawLine: "02/15 APPLE COM BILL ¥1,300",
  },
  {
    date: "02/15",
    description: "SPOTIFY",
    amount: 1280,
    rawLine: "02/15 SPOTIFY PREMIUM ¥1,280",
  },
  {
    date: "02/18",
    description: "NETFLIX",
    amount: 1590,
    rawLine: "02/18 NETFLIX.COM ¥1,590",
  },
  {
    date: "02/20",
    description: "YOUTUBE PREMIUM",
    amount: 1550,
    rawLine: "02/20 GOOGLE YOUTUBE PREMIUM ¥1,550",
  },
  {
    date: "02/22",
    description: "CHATGPT",
    amount: 3000,
    rawLine: "02/22 CHATGPT SUBSCRIPTION ¥3,000",
  },
  {
    date: "02/25",
    description: "AMAZON PRIME",
    amount: 600,
    rawLine: "02/25 AMAZON PRIME ¥600",
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
