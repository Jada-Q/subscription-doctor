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

## MSCA Law (Japan)

Apple is required to execute Japan's MSCA法案 by December 2025, which will:

- Allow alternative payment methods in apps
- Reduce Apple's commission to **10-15%** (down from 30%)
- This is a long-term tailwind -- the Apple tax may shrink but won't disappear

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
