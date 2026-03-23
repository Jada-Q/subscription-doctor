import type { PaymentMethod, MerchantCategory } from "../data/templates";

export interface RankedResult {
  method: PaymentMethod;
  effectiveRate: number;
  cashback: number;
  isOwned: boolean;
  rateSources: string;
}

/**
 * Get the effective rate for a payment method in a given category.
 * Priority: active campaign > category rate > base rate
 */
function getEffectiveRate(
  method: PaymentMethod,
  category: MerchantCategory
): { rate: number; source: string } {
  const now = new Date().toISOString().slice(0, 10);

  // Check active campaigns (highest priority)
  for (const c of method.campaigns) {
    if (c.endDate >= now && (c.category === category || c.category === "all")) {
      return { rate: c.rate, source: `キャンペーン: ${c.description}` };
    }
  }

  // Check category-specific rate
  const catRate = method.categoryRates.find((cr) => cr.category === category);
  if (catRate) {
    return { rate: catRate.rate, source: "カテゴリ特約" };
  }

  // Base rate
  return { rate: method.baseRate, source: "通常還元" };
}

/**
 * Calculate the best payment method for a given purchase.
 * Returns results sorted by cashback amount (descending).
 */
export function calculateBestPayment(
  category: MerchantCategory,
  amount: number,
  methods: PaymentMethod[],
  ownedIds: Set<string>
): RankedResult[] {
  return methods
    .map((method) => {
      const { rate, source } = getEffectiveRate(method, category);
      return {
        method,
        effectiveRate: rate,
        cashback: Math.floor(amount * rate),
        isOwned: ownedIds.has(method.id),
        rateSources: source,
      };
    })
    .sort((a, b) => b.cashback - a.cashback);
}
