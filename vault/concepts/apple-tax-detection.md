Apple tax detection is Subscription Doctor's core differentiating feature -- identifying subscriptions where users pay more through the App Store than they would paying the service provider directly.

## How It Works

1. OCR extracts transaction amounts from credit card statement screenshots
2. Rule matching identifies the subscription service (e.g., Netflix, YouTube Premium)
3. The matched rule contains both `appStorePrice` and `officialPrice`
4. If `appStorePrice > officialPrice`, the difference is flagged as "Apple tax"

## Pricing Data Approach

- Price data is stored in `src/data/rules.json` as part of each subscription rule
- Data is labeled as "community-sourced" (社区众包) to avoid Apple ToS violations
- No direct App Store scraping -- prices are manually maintained

## MSCA Law (Japan) — Updated 2026-07-05

MSCA（スマホソフトウェア競争促進法）は **2025年12月18日に施行済み**。iOS 26.2で対応。

実際の手数料体系（PROJECT_PLANの「10-15%」は不正確だった）:

- App Store標準コミッション: **21%** + Apple IAP利用時は決済処理手数料5% = **合計26%**
- 従来30%からの実質削減は **わずか4%**
- Small Business Program / 2年目以降サブスク: 基本 **10%**（従来15%から）
- 代替マーケットプレイス経由: Core Technology Commission **5%**

2026年2月、IT関連7業界団体（600社超）が「経済的インセンティブがない」と緊急共同声明。

**→ Apple税は依然として有効な訴求ポイント。手数料削減が小さいため、App Store経由 vs 公式サイトの価格差は今後も残る。**

Sources:

- https://www.apple.com/newsroom/2025/12/apple-announces-changes-to-ios-in-japan/
- https://developer.apple.com/support/app-distribution-in-japan/
- https://mcf.or.jp/newsletter/20260205-41651

## Example

| Service          | App Store Price | Official Price | Annual Apple Tax |
| ---------------- | --------------- | -------------- | ---------------- |
| Netflix Standard | 1,590           | 1,490          | 1,200            |
| YouTube Premium  | 1,280           | 1,180          | 1,200            |

## Related

- [[rocket-money]] -- Does not detect Apple tax
- [[wallos]] -- Does not detect Apple tax
- [[subsHub]] -- Does not detect Apple tax
- [[privacy-first-architecture]] -- Detection runs entirely client-side
- [[subscription-market-japan]] -- Apple tax is especially relevant in iOS-heavy Japan
