export interface ServiceRule {
  id: string;
  service: string;
  plan: string;
  keywords: string[];
  appStorePrice: number;
  officialPrice: number;
  category: string;
  billingCycle: "monthly" | "annual";
  overlaps: string[];
}

export interface MatchedTransaction {
  date: string;
  description: string;
  amount: number;
  matchedService: string | null;
  matchedRule: ServiceRule | null;
  matchType: "keyword_exact" | "keyword_partial" | "unmatched";
  appleTaxAmount: number; // appStorePrice - officialPrice, 0 if no tax
  billingCycle: "monthly" | "annual" | "unknown";
  rawLine: string;
}
