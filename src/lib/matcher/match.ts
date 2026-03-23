import type { ParsedTransaction } from "../parser/types";
import type { ServiceRule, MatchedTransaction } from "./types";
import rulesData from "../../data/rules.json";

const rules: ServiceRule[] = rulesData as ServiceRule[];

/**
 * Normalize string for matching: uppercase, remove spaces
 */
function normalizeForMatch(str: string): string {
  return str.toUpperCase().replace(/[\s.,-]/g, "");
}

/**
 * Match a parsed transaction against the rule database.
 */
function matchTransaction(tx: ParsedTransaction): MatchedTransaction {
  const descNorm = normalizeForMatch(tx.description);

  // Try exact keyword match first
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const kwNorm = normalizeForMatch(keyword);
      if (descNorm === kwNorm) {
        return buildMatch(tx, rule, "keyword_exact");
      }
    }
  }

  // Try partial keyword match (keyword contained in description or vice versa)
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const kwNorm = normalizeForMatch(keyword);
      if (descNorm.includes(kwNorm) || kwNorm.includes(descNorm)) {
        return buildMatch(tx, rule, "keyword_partial");
      }
    }
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
    matchedService: rule.service,
    matchedRule: rule,
    matchType,
    appleTaxAmount: appleTax > 0 ? appleTax : 0,
    billingCycle: rule.billingCycle,
    rawLine: tx.rawLine,
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
 * Get all rules for reference.
 */
export function getRules(): ServiceRule[] {
  return rules;
}
