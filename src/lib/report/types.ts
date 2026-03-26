import type { MatchedTransaction } from "../matcher/types";

export type Grade = "green" | "yellow" | "red";

export interface CrossCardDuplicate {
  ruleId: string;
  serviceName: string;
  instances: MatchedTransaction[]; // one per card where it appears
  totalMonthly: number;
  savingsMonthly: number; // total minus cheapest (keep one, drop rest)
}

export interface Report {
  score: number; // 0-100
  grade: Grade;
  totalMonthly: number;
  totalAnnual: number;
  allTransactions: MatchedTransaction[];
  appleTaxItems: MatchedTransaction[];
  appleTaxTotal: number;
  overlaps: MatchedTransaction[][];
  crossCardDuplicates: CrossCardDuplicate[];
  crossCardSavingsMonthly: number;
  crossCardSavingsAnnual: number;
  cardCount: number; // 0 or 1 = single-card mode
  savingsMonthly: number; // Apple tax + overlap + cross-card savings
  savingsAnnual: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
}
