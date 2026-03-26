export interface ParsedTransaction {
  date: string; // MM/DD or YYYY/MM/DD
  description: string; // raw service name from OCR
  amount: number; // JPY amount
  rawLine: string; // original OCR line for debugging
  isLikelySubscription?: boolean; // true if line has subscription-indicating keywords
  cardIndex?: number; // 0-based index of source card (multi-card mode)
}

export type CardIssuer = "rakuten" | "smbc" | "jcb" | "generic";

export interface ParserConfig {
  issuer: CardIssuer;
}
