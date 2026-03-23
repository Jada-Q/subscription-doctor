import type { ParsedTransaction, CardIssuer } from "./types";
import { normalizeText, removeNumberCommas } from "./normalize";

/**
 * Extract date from a text line.
 * Handles: 01/15, 2026/01/15, 26/01/15, 01-15, 0115
 */
function extractDate(text: string): string | null {
  // YY/MM/DD or YYYY/MM/DD
  const fullMatch = text.match(/(\d{2,4}\/\d{1,2}\/\d{1,2})/);
  if (fullMatch) return fullMatch[1];

  // MM/DD
  const shortSlash = text.match(/(\d{1,2}\/\d{1,2})/);
  if (shortSlash) return shortSlash[1];

  // MMDD at start of line (PaddleOCR sometimes strips slash)
  const mmdd = text.match(/^(\d{2})(\d{2})\s/);
  if (mmdd) return `${mmdd[1]}/${mmdd[2]}`;

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
 * Extract service description from a line after removing date and amount.
 */
function extractDescription(text: string, date: string | null, amount: number | null): string {
  let desc = text;

  // Remove date part
  if (date) {
    desc = desc.replace(date, "").replace(date.replace("/", ""), "");
  }

  // Remove amount part (with yen symbols, commas)
  if (amount !== null) {
    const amountStr = amount.toString();
    desc = desc.replace(new RegExp(`¥\\s*[\\d,]*${amountStr}`), "");
    desc = desc.replace(new RegExp(`\\b${amountStr}\\b\\s*円?`), "");
  }

  // Remove common suffixes that aren't part of service name
  desc = desc.replace(/ご本人/g, "");
  desc = desc.replace(/ご家族/g, "");
  desc = desc.replace(/[¥円]/g, "");

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
];

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
    });
  }

  return transactions;
}
