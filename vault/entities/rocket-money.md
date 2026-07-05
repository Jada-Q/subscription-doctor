Rocket Money is the US market leader in subscription management, acquired for $1.275 billion in 2021 and credited with saving users over $2.5 billion.

## Key Facts

- **Market**: United States
- **Core capability**: Bank API integration for automatic subscription detection and cancellation on behalf of users
- **Acquisition**: Purchased for $1.275B (2021), validating the subscription audit market
- **Cumulative savings**: $2.5B+ for users

## Relationship to Subscription Doctor

Rocket Money is the primary market validation reference for Subscription Doctor. Its massive exit proves the subscription audit space is viable. However, the two products differ fundamentally:

| Dimension   | Rocket Money                        | Subscription Doctor               |
| ----------- | ----------------------------------- | --------------------------------- |
| Market      | US only                             | Japan-focused                     |
| Data access | Bank API (requires account linking) | Screenshot OCR (local processing) |
| Privacy     | User data sent to servers           | All processing in-browser         |
| Apple tax   | Not detected                        | Core feature                      |

Rocket Money's bank-API approach is a **privacy weakness** that Subscription Doctor exploits -- Japanese users are especially reluctant to share banking credentials. See [[privacy-first-architecture]].

## Related Concepts

- [[privacy-first-architecture]] -- Subscription Doctor's key differentiator vs Rocket Money
- [[apple-tax-detection]] -- Feature Rocket Money lacks entirely
- [[subscription-market-japan]] -- Why Rocket Money doesn't serve this market
