import type { ParsedTransaction } from "../parser/types";
import type { ServiceRule, MatchedTransaction } from "./types";
import type { CrossCardDuplicate } from "../report/types";
import rulesData from "../../data/rules.json";

const rules: ServiceRule[] = rulesData as ServiceRule[];

/**
 * Normalize string for matching: uppercase, remove spaces and punctuation
 */
function normalizeForMatch(str: string): string {
  return str.toUpperCase().replace(/[\s.,-]/g, "");
}

/**
 * Find all rules whose keyword matches the description.
 */
function findKeywordMatches(
  descNorm: string,
  matchType: "exact" | "partial"
): ServiceRule[] {
  const matches: ServiceRule[] = [];
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const kwNorm = normalizeForMatch(keyword);
      if (matchType === "exact" && descNorm === kwNorm) {
        matches.push(rule);
        break;
      }
      if (
        matchType === "partial" &&
        (descNorm.includes(kwNorm) || kwNorm.includes(descNorm))
      ) {
        matches.push(rule);
        break;
      }
    }
  }
  return matches;
}

/**
 * From a list of candidate rules, pick the best match using amount disambiguation.
 * If multiple rules share the same keyword (e.g. "APPLE COM BILL"),
 * prefer the one whose `amounts` array includes the transaction amount.
 */
function disambiguateByAmount(
  candidates: ServiceRule[],
  amount: number
): ServiceRule {
  // First: check for exact amount match
  const amountMatch = candidates.find(
    (r) => r.amounts.length > 0 && r.amounts.includes(amount)
  );
  if (amountMatch) return amountMatch;

  // Second: prefer rules with no amounts constraint (generic match)
  const generic = candidates.find((r) => r.amounts.length === 0);
  if (generic) return generic;

  // Fallback: first candidate
  return candidates[0];
}

/**
 * Match a parsed transaction against the rule database.
 */
function matchTransaction(tx: ParsedTransaction): MatchedTransaction {
  const descNorm = normalizeForMatch(tx.description);

  // Try exact keyword match first
  const exactMatches = findKeywordMatches(descNorm, "exact");
  if (exactMatches.length > 0) {
    const rule = disambiguateByAmount(exactMatches, tx.amount);
    return buildMatch(tx, rule, "keyword_exact");
  }

  // Try partial keyword match
  const partialMatches = findKeywordMatches(descNorm, "partial");
  if (partialMatches.length > 0) {
    const rule = disambiguateByAmount(partialMatches, tx.amount);
    return buildMatch(tx, rule, "keyword_partial");
  }

  // Unmatched
  return {
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    matchedService: null,
    matchedRule: null,
    matchType: "unmatched",
    appleTaxAmount: 0,
    billingCycle: "unknown",
    rawLine: tx.rawLine,
    ...(tx.cardIndex !== undefined && { cardIndex: tx.cardIndex }),
  };
}

function buildMatch(
  tx: ParsedTransaction,
  rule: ServiceRule,
  matchType: "keyword_exact" | "keyword_partial"
): MatchedTransaction {
  const appleTax = rule.appStorePrice - rule.officialPrice;
  return {
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    matchedService: `${rule.service}${rule.plan ? ` (${rule.plan})` : ""}`,
    matchedRule: rule,
    matchType,
    appleTaxAmount: appleTax > 0 ? appleTax : 0,
    billingCycle: rule.billingCycle,
    rawLine: tx.rawLine,
    ...(tx.cardIndex !== undefined && { cardIndex: tx.cardIndex }),
  };
}

/**
 * Match all parsed transactions against rules.
 */
export function matchTransactions(
  transactions: ParsedTransaction[]
): MatchedTransaction[] {
  return transactions.map(matchTransaction);
}

/**
 * Detect duplicate/overlapping subscriptions.
 * Returns groups of overlapping matched services.
 */
export function detectOverlaps(
  matched: MatchedTransaction[]
): MatchedTransaction[][] {
  const serviceIds = new Set<string>();
  const matchedWithRules = matched.filter((m) => m.matchedRule);

  // Collect all matched service IDs
  for (const m of matchedWithRules) {
    if (m.matchedRule) serviceIds.add(m.matchedRule.id);
  }

  // Find overlap groups
  const groups: MatchedTransaction[][] = [];
  const visited = new Set<string>();

  for (const m of matchedWithRules) {
    const rule = m.matchedRule!;
    if (visited.has(rule.id)) continue;

    const overlapIds = rule.overlaps.filter((id) => serviceIds.has(id));
    if (overlapIds.length === 0) continue;

    const group = [m];
    visited.add(rule.id);

    for (const oid of overlapIds) {
      if (visited.has(oid)) continue;
      const overlapMatch = matchedWithRules.find(
        (om) => om.matchedRule?.id === oid
      );
      if (overlapMatch) {
        group.push(overlapMatch);
        visited.add(oid);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Detect the same subscription service appearing on different cards.
 * Returns groups where the same rule.id is matched on 2+ distinct cardIndex values.
 */
export function detectCrossCardDuplicates(
  matched: MatchedTransaction[]
): CrossCardDuplicate[] {
  const byRule = new Map<string, MatchedTransaction[]>();

  for (const m of matched) {
    if (m.matchedRule && m.cardIndex !== undefined) {
      const existing = byRule.get(m.matchedRule.id);
      if (existing) {
        existing.push(m);
      } else {
        byRule.set(m.matchedRule.id, [m]);
      }
    }
  }

  const duplicates: CrossCardDuplicate[] = [];
  for (const [ruleId, instances] of byRule) {
    const uniqueCards = new Set(instances.map((i) => i.cardIndex));
    if (uniqueCards.size < 2) continue;

    const sorted = [...instances].sort((a, b) => a.amount - b.amount);
    const total = instances.reduce((s, i) => s + i.amount, 0);
    const savings = total - sorted[0].amount;

    duplicates.push({
      ruleId,
      serviceName: instances[0].matchedService!,
      instances,
      totalMonthly: total,
      savingsMonthly: savings,
    });
  }

  return duplicates;
}

/**
 * Get all rules for reference.
 */
export function getRules(): ServiceRule[] {
  return rules;
}
