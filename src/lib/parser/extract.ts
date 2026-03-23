import type { ParsedTransaction, CardIssuer } from "./types";
import { normalizeText, removeNumberCommas } from "./normalize";

/**
 * Extract date from a text line.
 * Handles many Japanese credit card date formats.
 */
function extractDate(text: string): string | null {
  // YYYY/MM/DD or YY/MM/DD
  const fullMatch = text.match(/(\d{2,4}\/\d{1,2}\/\d{1,2})/);
  if (fullMatch) return fullMatch[1];

  // MM/DD (anywhere in text)
  const shortSlash = text.match(/(\d{1,2}\/\d{1,2})/);
  if (shortSlash) return shortSlash[1];

  // MM月DD日 (Japanese format)
  const jpDate = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (jpDate) return `${jpDate[1]}/${jpDate[2]}`;

  // MM-DD
  const dashDate = text.match(/(\d{1,2})-(\d{1,2})(?!\d)/);
  if (dashDate) return `${dashDate[1]}/${dashDate[2]}`;

  // MM.DD (dot separator)
  const dotDate = text.match(/(\d{1,2})\.(\d{1,2})(?!\d)/);
  if (dotDate) return `${dotDate[1]}/${dotDate[2]}`;

  // MMDD at start of line (PaddleOCR sometimes strips slash)
  const mmddStart = text.match(/^(\d{2})(\d{2})\s/);
  if (mmddStart) return `${mmddStart[1]}/${mmddStart[2]}`;

  // MMDD anywhere followed by space + Japanese text (common OCR output)
  const mmddAnywhere = text.match(/(\d{2})(\d{2})\s+[A-Za-z\u3000-\u9fff]/);
  if (mmddAnywhere) {
    const m = parseInt(mmddAnywhere[1], 10);
    const d = parseInt(mmddAnywhere[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${mmddAnywhere[1]}/${mmddAnywhere[2]}`;
    }
  }

  return null;
}

/**
 * Extract amount in JPY from text.
 * Handles: ¥1,300 / ¥1300 / 1,300円 / 1300
 */
function extractAmount(text: string): number | null {
  const normalized = removeNumberCommas(text);

  // ¥ prefix
  const yenMatch = normalized.match(/¥\s*(\d+)/);
  if (yenMatch) return parseInt(yenMatch[1], 10);

  // 円 suffix
  const enMatch = normalized.match(/(\d+)\s*円/);
  if (enMatch) return parseInt(enMatch[1], 10);

  // Standalone number at end (likely amount)
  const numMatch = normalized.match(/\s(\d{3,})$/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return null;
}

/**
 * Format a number as a comma-separated string: 4033 → "4,033"
 */
function formatWithCommas(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Extract service description from a line after removing date and amount.
 */
function extractDescription(text: string, date: string | null, amount: number | null): string {
  let desc = text;

  // Remove date part (slash format and original Japanese format)
  if (date) {
    desc = desc.replace(date, "");
    desc = desc.replace(date.replace("/", ""), "");
    const dateParts = date.split("/");
    if (dateParts.length === 2) {
      desc = desc.replace(`${dateParts[0]}月${dateParts[1]}日`, "");
    }
  }

  // Remove amount part (with yen symbols, commas, various formats)
  if (amount !== null) {
    const amountStr = amount.toString();
    const amountWithCommas = formatWithCommas(amount);
    desc = desc.replace(new RegExp(`¥\\s*${amountWithCommas.replace(/,/g, ",?")}`), "");
    desc = desc.replace(new RegExp(`¥\\s*${amountStr}`), "");
    desc = desc.replace(new RegExp(`${amountWithCommas.replace(/,/g, ",?")}\\s*円?`), "");
    desc = desc.replace(new RegExp(`(^|\\s)${amountStr}\\s*円?(\\s|$)`), "$1$2");
  }

  // Remove common suffixes that aren't part of service name
  desc = desc.replace(/ご本人/g, "");
  desc = desc.replace(/ご家族/g, "");
  desc = desc.replace(/[¥円]/g, "");
  desc = desc.replace(/^[\s\-・.]+|[\s\-・.]+$/g, "");

  return desc.trim();
}

// Lines to skip entirely
const SKIP_PATTERNS = [
  /^(ご利用日|ご利用先|金額|お支払い|ご請求|カード|明細|合計)/,
  /^[a-zA-Z]+カード/, // card name header
  /^\d{4}年/, // year header like 2026年
  /回払い/, // payment method: 1回払い, 2回払い, etc.
  /リボ払い/, // revolving payment
  /分割払い/, // installment payment
  /ボーナス払い/, // bonus payment
  /^\s*合計\s*¥/, // total line
  /お支払い方法/, // payment method header
  /ポイント/, // point-related lines
  /キャッシング/, // cash advance
  /^利用枠/, // credit limit
  /^お引落し/, // direct debit info
  /^お振替/, // transfer info
  /^(前月|今月|翌月)/, // month reference headers
  /ご利用可能額/, // available credit
  /お支払い日/, // payment date
  /締め日/, // closing date
  /^(新規|繰越|小計)/, // subtotal headers
];

/**
 * Patterns that indicate a line is likely a subscription/recurring charge
 * (used to tag transactions, not to filter)
 */
const SUBSCRIPTION_INDICATORS = [
  /月額/, /利用料/, /料金/, /会費/, /定額/,
  /SUBSCRIPTION/, /PREMIUM/, /PLUS/, /PRO/i,
  /\.COM/, /\.CO\.JP/, /\.IO/,
  /BILL/,
];

/**
 * Check if a description looks like a subscription/recurring charge
 */
function isLikelySubscription(description: string, rawLine: string): boolean {
  const upper = rawLine.toUpperCase();
  return SUBSCRIPTION_INDICATORS.some((p) => p.test(upper) || p.test(description));
}

/**
 * Parse OCR lines into structured transactions.
 * Filters out header/footer/payment-method lines and extracts date, description, amount.
 */
export function parseTransactions(
  ocrText: string,
  _issuer: CardIssuer = "generic"
): ParsedTransaction[] {
  const lines = ocrText.split("\n").map(normalizeText).filter(Boolean);
  const transactions: ParsedTransaction[] = [];
  let lastDate: string | null = null;

  for (const line of lines) {
    // Skip non-transaction lines
    if (SKIP_PATTERNS.some((p) => p.test(line))) continue;

    const date = extractDate(line);
    const amount = extractAmount(line);

    // Track last seen date for lines that have amount but no date
    if (date) lastDate = date;

    // A transaction line needs an amount > 0
    if (!amount || amount === 0) continue;

    const effectiveDate = date || lastDate || "unknown";
    const description = extractDescription(line, date, amount);

    // Skip if description is too short (likely noise)
    if (description.length < 2) continue;

    transactions.push({
      date: effectiveDate,
      description,
      amount,
      rawLine: line,
      isLikelySubscription: isLikelySubscription(description, line),
    });
  }

  return transactions;
}
