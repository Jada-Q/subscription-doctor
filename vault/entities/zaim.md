Zaim is Japan's largest household budget app (1,000万DL+, くふうカンパニー) with a built-in subscription checker since 2020.

## Key Facts

- **Product**: 定額サービスチェッカー (launched 2020-06-30, free for all users)
- **Approach**: Auto-detects subscriptions from linked bank/credit card transaction history
- **Features**: Payment amount, due date, plan prediction; monthly total visualization
- **Scale**: 1,300+ financial institution integrations
- **Parent**: くふうカンパニー (publicly listed)

## Relationship to Subscription Doctor

Zaim is the closest existing Japanese competitor for subscription auditing. Key differences:

| Dimension      | Zaim                                 | Subscription Doctor          |
| -------------- | ------------------------------------ | ---------------------------- |
| Data source    | Bank API (server-side)               | OCR screenshot (client-side) |
| Privacy        | Data sent to servers                 | Data stays on device         |
| Setup friction | Account creation + bank linking      | Upload screenshot            |
| Detection      | Transaction history pattern matching | Rule-based keyword matching  |
| Apple tax      | Not detected                         | Core feature                 |

**Zaim's weakness**: Requires users to trust a third party with banking credentials — the exact friction point [[privacy-first-architecture]] addresses.

## Related

- [[money-forward]] — Similar bank-linking approach
- [[subscription-market-japan]] — Market context
- [[privacy-first-architecture]] — Our counter-positioning

Source: https://content.zaim.net/flatrates | Verified: 2026-07-05 | Expires: 2026-10-05
