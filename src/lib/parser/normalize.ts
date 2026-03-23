/**
 * Normalize OCR text for Japanese credit card statements.
 * Full-width → half-width conversion, whitespace cleanup.
 */

// Full-width ASCII → half-width (！→!, ０→0, Ａ→A, etc.)
export function fullToHalf(str: string): string {
  return str.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

// Full-width space → half-width
export function normalizeSpaces(str: string): string {
  return str.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

// Normalize yen symbol variants
export function normalizeYen(str: string): string {
  return str.replace(/[￥\\¥]/g, "¥");
}

// Remove commas from numbers: 1,300 → 1300
export function removeNumberCommas(str: string): string {
  return str.replace(/(\d),(\d)/g, "$1$2");
}

// Full normalization pipeline
export function normalizeText(str: string): string {
  let result = fullToHalf(str);
  result = normalizeSpaces(result);
  result = normalizeYen(result);
  return result;
}
