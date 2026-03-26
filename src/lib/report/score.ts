import type { MatchedTransaction } from "../matcher/types";
import type { Report, Grade, CrossCardDuplicate } from "./types";

/**
 * Generate a health report from matched transactions and overlap groups.
 *
 * Scoring (100 = perfect):
 * - Start at 100
 * - Deduct 5 points per Apple tax item (paying more than necessary)
 * - Deduct 10 points per overlap group (duplicate services)
 * - Deduct 1 point per ¥500 of monthly Apple tax
 * - Deduct 15 points per cross-card duplicate (same service on multiple cards)
 * - Floor at 0
 */
export function generateReport(
  matched: MatchedTransaction[],
  overlaps: MatchedTransaction[][],
  crossCardDuplicates: CrossCardDuplicate[] = []
): Report {
  const appleTaxItems = matched.filter((m) => m.appleTaxAmount > 0);
  const appleTaxTotal = appleTaxItems.reduce(
    (sum, m) => sum + m.appleTaxAmount,
    0
  );
  const totalMonthly = matched
    .filter((m) => m.matchedService)
    .reduce((sum, m) => sum + m.amount, 0);
  const matchedCount = matched.filter((m) => m.matchedService).length;
  const unmatchedCount = matched.length - matchedCount;

  // Calculate potential savings from overlaps (cheaper service in each group)
  let overlapSavings = 0;
  for (const group of overlaps) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.amount - b.amount);
    for (let i = 1; i < sorted.length; i++) {
      overlapSavings += sorted[i].amount;
    }
  }

  // Calculate cross-card duplicate savings
  const crossCardSavingsMonthly = crossCardDuplicates.reduce(
    (sum, d) => sum + d.savingsMonthly,
    0
  );

  const savingsMonthly = appleTaxTotal + overlapSavings + crossCardSavingsMonthly;
  const savingsAnnual = savingsMonthly * 12;

  // Determine card count from transactions
  const cardIndices = new Set(
    matched.filter((m) => m.cardIndex !== undefined).map((m) => m.cardIndex)
  );
  const cardCount = cardIndices.size || (matched.length > 0 ? 1 : 0);

  // Score calculation — only penalize actionable items, not unmatched
  let score = 100;
  score -= appleTaxItems.length * 5;
  score -= overlaps.length * 10;
  score -= Math.floor(appleTaxTotal / 500);
  score -= crossCardDuplicates.length * 15;
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
    crossCardDuplicates,
    crossCardSavingsMonthly,
    crossCardSavingsAnnual: crossCardSavingsMonthly * 12,
    cardCount,
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
