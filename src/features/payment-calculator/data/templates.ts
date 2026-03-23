export type MerchantCategory =
  | "convenience"
  | "supermarket"
  | "restaurant"
  | "drugstore"
  | "online"
  | "transportation"
  | "utility"
  | "other";

export const MERCHANT_CATEGORIES: {
  id: MerchantCategory;
  label: string;
  icon: string;
}[] = [
  { id: "convenience", label: "コンビニ", icon: "🏪" },
  { id: "supermarket", label: "スーパー", icon: "🛒" },
  { id: "restaurant", label: "飲食店", icon: "🍽️" },
  { id: "drugstore", label: "ドラッグストア", icon: "💊" },
  { id: "online", label: "ネット通販", icon: "📦" },
  { id: "transportation", label: "交通", icon: "🚃" },
  { id: "utility", label: "公共料金", icon: "💡" },
  { id: "other", label: "その他", icon: "🏷️" },
];

export interface Campaign {
  description: string;
  category: MerchantCategory | "all";
  rate: number;
  endDate: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: "credit" | "debit" | "ewallet";
  baseRate: number;
  categoryRates: { category: MerchantCategory; rate: number }[];
  campaigns: Campaign[];
  affiliateUrl?: string;
  color: string;
}

export const PAYMENT_TEMPLATES: PaymentMethod[] = [
  {
    id: "rakuten_card",
    name: "楽天カード",
    type: "credit",
    baseRate: 0.01,
    categoryRates: [
      { category: "online", rate: 0.03 },
    ],
    campaigns: [],
    affiliateUrl: "https://www.rakuten-card.co.jp/",
    color: "#bf0000",
  },
  {
    id: "smbc_nl",
    name: "三井住友NL",
    type: "credit",
    baseRate: 0.005,
    categoryRates: [
      { category: "convenience", rate: 0.07 },
      { category: "restaurant", rate: 0.07 },
    ],
    campaigns: [],
    affiliateUrl: "https://www.smbc-card.com/",
    color: "#00a650",
  },
  {
    id: "jcb_card_w",
    name: "JCB CARD W",
    type: "credit",
    baseRate: 0.01,
    categoryRates: [
      { category: "online", rate: 0.02 },
    ],
    campaigns: [],
    affiliateUrl: "https://www.jcb.co.jp/",
    color: "#003da5",
  },
  {
    id: "paypay_card",
    name: "PayPayカード",
    type: "credit",
    baseRate: 0.01,
    categoryRates: [
      { category: "online", rate: 0.05 },
    ],
    campaigns: [],
    affiliateUrl: "https://card.paypay.ne.jp/",
    color: "#ff0033",
  },
  {
    id: "d_card",
    name: "dカード",
    type: "credit",
    baseRate: 0.01,
    categoryRates: [
      { category: "drugstore", rate: 0.04 },
    ],
    campaigns: [],
    affiliateUrl: "https://d-card.jp/",
    color: "#e60012",
  },
];
