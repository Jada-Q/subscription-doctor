/**
 * Categorize unmatched transactions by merchant type.
 * Uses keyword matching against common Japanese merchants and categories.
 */

interface MerchantCategory {
  label: string;
  keywords: string[];
}

const MERCHANT_CATEGORIES: MerchantCategory[] = [
  {
    label: "スーパー・食品",
    keywords: [
      "ハナマサ", "イオン", "イトーヨーカドー", "西友", "ライフ", "マルエツ",
      "サミット", "オーケー", "業務スーパー", "コストコ", "成城石井", "紀伊國屋",
      "ヤオコー", "マックスバリュ", "ダイエー", "東急ストア", "京急ストア",
      "AEON", "COSTCO", "SEIYU",
    ],
  },
  {
    label: "コンビニ",
    keywords: [
      "セブンイレブン", "ファミリーマート", "ローソン", "ミニストップ", "デイリーヤマザキ",
      "SEVEN", "FAMILYMART", "LAWSON",
    ],
  },
  {
    label: "飲食",
    keywords: [
      "マクドナルド", "スターバックス", "吉野家", "松屋", "すき家", "ガスト",
      "サイゼリヤ", "ココイチ", "丸亀製麺", "鳥貴族", "ワタミ", "焼肉",
      "寿司", "ラーメン", "カフェ", "レストラン", "居酒屋", "食堂",
      "MCDONALD", "STARBUCKS", "UBER EATS", "UBEREATS", "出前館",
    ],
  },
  {
    label: "交通・カーシェア",
    keywords: [
      "タイムズ", "TIMES", "タイムズカー", "カレコ", "CARECO",
      "JR", "メトロ", "SUICA", "PASMO", "ETC",
      "UBER", "タクシー", "TAXI", "DIDI",
      "ANA", "JAL", "ピーチ", "JETSTAR",
      "駐車", "パーキング", "PARKING",
    ],
  },
  {
    label: "ドラッグストア",
    keywords: [
      "マツモトキヨシ", "ウエルシア", "スギ薬局", "ツルハ", "サンドラッグ",
      "ココカラ", "薬局", "ドラッグ",
    ],
  },
  {
    label: "ショッピング",
    keywords: [
      "AMAZON", "アマゾン", "楽天市場", "YAHOO", "メルカリ",
      "ユニクロ", "UNIQLO", "ZARA", "GU", "無印良品", "MUJI",
      "ヨドバシ", "ビックカメラ", "ヤマダ電機", "ケーズデンキ",
      "ニトリ", "IKEA", "ダイソー", "SERIA",
    ],
  },
  {
    label: "医療・健康",
    keywords: [
      "病院", "クリニック", "歯科", "薬局", "調剤",
      "フィットネス", "ジム", "GYM", "ANYTIME",
    ],
  },
  {
    label: "教育・習い事",
    keywords: [
      "スクール", "SCHOOL", "教室", "塾", "予備校",
      "UDEMY", "COURSERA",
    ],
  },
  {
    label: "娯楽・レジャー",
    keywords: [
      "映画", "シネマ", "CINEMA", "TOHO",
      "遊園地", "テーマパーク", "ゲームセンター",
      "ボウリング", "カラオケ",
      "農園", "ファーム", "FARM", "観光",
    ],
  },
  {
    label: "公共料金",
    keywords: [
      "東京電力", "関西電力", "中部電力", "東京ガス", "大阪ガス",
      "水道", "電気", "ガス代",
      "NHK", "受信料",
    ],
  },
  {
    label: "保険",
    keywords: [
      "保険", "生命保険", "損保", "INSURANCE",
    ],
  },
];

/**
 * Try to categorize an unmatched transaction description.
 * Returns a Japanese label or null if no match.
 */
export function categorizeMerchant(description: string): string | null {
  const upper = description.toUpperCase();
  for (const cat of MERCHANT_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (upper.includes(kw.toUpperCase())) {
        return cat.label;
      }
    }
  }
  return null;
}
