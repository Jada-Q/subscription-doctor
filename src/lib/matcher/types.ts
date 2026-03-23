export interface ServiceRule {
  id: string;
  service: string;
  plan: string;
  keywords: string[];
  amounts: number[]; // known amounts for disambiguation (empty = match any)
  appStorePrice: number;
  officialPrice: number;
  category: string;
  billingCycle: "monthly" | "annual" | "yearly" | "weekly";
  overlaps: string[];
  advice: string; // optimization tip in Japanese
  alternatives: Alternative[]; // cheaper/better alternatives
  cancelUrl?: string; // direct link to official cancellation page
}

export interface Alternative {
  name: string;
  price: number; // monthly JPY
  note: string; // short description
}

export interface MatchedTransaction {
  date: string;
  description: string;
  amount: number;
  matchedService: string | null;
  matchedRule: ServiceRule | null;
  matchType: "keyword_exact" | "keyword_partial" | "unmatched";
  appleTaxAmount: number; // appStorePrice - officialPrice, 0 if no tax
  billingCycle: "monthly" | "annual" | "yearly" | "weekly" | "unknown";
  rawLine: string;
}
