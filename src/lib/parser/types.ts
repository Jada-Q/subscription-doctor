export interface ParsedTransaction {
  date: string; // MM/DD or YYYY/MM/DD
  description: string; // raw service name from OCR
  amount: number; // JPY amount
  rawLine: string; // original OCR line for debugging
}

export type CardIssuer = "rakuten" | "smbc" | "jcb" | "generic";

export interface ParserConfig {
  issuer: CardIssuer;
}
