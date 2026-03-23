import type { MatchedTransaction } from "../matcher/types";

export type Grade = "green" | "yellow" | "red";

export interface Report {
  score: number; // 0-100
  grade: Grade;
  totalMonthly: number;
  totalAnnual: number;
  allTransactions: MatchedTransaction[];
  appleTaxItems: MatchedTransaction[];
  appleTaxTotal: number;
  overlaps: MatchedTransaction[][];
  savingsMonthly: number; // Apple tax + overlap savings potential
  savingsAnnual: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
}
