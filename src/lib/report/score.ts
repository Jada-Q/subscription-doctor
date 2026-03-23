import type { MatchedTransaction } from "../matcher/types";
import type { Report, Grade } from "./types";

/**
 * Generate a health report from matched transactions and overlap groups.
 *
 * Scoring (100 = perfect):
 * - Start at 100
 * - Deduct 5 points per Apple tax item (paying more than necessary)
 * - Deduct 10 points per overlap group (duplicate services)
 * - Deduct 1 point per ¥500 of monthly Apple tax
 * - Deduct 2 points per unmatched item (potential untracked subscription)
 * - Floor at 0
 */
export function generateReport(
  matched: MatchedTransaction[],
  overlaps: MatchedTransaction[][]
): Report {
  const appleTaxItems = matched.filter((m) => m.appleTaxAmount > 0);
  const appleTaxTotal = appleTaxItems.reduce(
    (sum, m) => sum + m.appleTaxAmount,
    0
  );
  const totalMonthly = matched.reduce((sum, m) => sum + m.amount, 0);
  const matchedCount = matched.filter((m) => m.matchedService).length;
  const unmatchedCount = matched.length - matchedCount;

  // Calculate potential savings from overlaps (cheaper service in each group)
  let overlapSavings = 0;
  for (const group of overlaps) {
    if (group.length < 2) continue;
    // Suggest dropping the more expensive one
    const sorted = [...group].sort((a, b) => a.amount - b.amount);
    // Savings = sum of all except cheapest
    for (let i = 1; i < sorted.length; i++) {
      overlapSavings += sorted[i].amount;
    }
  }

  const savingsMonthly = appleTaxTotal + overlapSavings;
  const savingsAnnual = savingsMonthly * 12;

  // Score calculation
  let score = 100;
  score -= appleTaxItems.length * 5;
  score -= overlaps.length * 10;
  score -= Math.floor(appleTaxTotal / 500);
  score -= unmatchedCount * 2;
  score = Math.max(0, Math.min(100, score));

  const grade = scoreToGrade(score);

  return {
    score,
    grade,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    allTransactions: matched,
    appleTaxItems,
    appleTaxTotal,
    overlaps,
    savingsMonthly,
    savingsAnnual,
    matchedCount,
    unmatchedCount,
    totalCount: matched.length,
  };
}

function scoreToGrade(score: number): Grade {
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

/**
 * Get a Japanese label for the grade.
 */
export function gradeLabel(grade: Grade): string {
  switch (grade) {
    case "green":
      return "良好";
    case "yellow":
      return "要注意";
    case "red":
      return "要改善";
  }
}

/**
 * Get emoji for the grade (used in share card).
 */
export function gradeEmoji(grade: Grade): string {
  switch (grade) {
    case "green":
      return "🟢";
    case "yellow":
      return "🟡";
    case "red":
      return "🔴";
  }
}
