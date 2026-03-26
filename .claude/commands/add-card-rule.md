Add a new subscription service rule to src/data/rules.json.

Ask me for:
1. Service name (Japanese and English)
2. How it appears on credit card statements (keywords)
3. App Store price and official price
4. Category
5. Known overlapping services

Then:
- Add the rule to rules.json following existing format
- Ensure overlaps are bidirectional
- Run the validator (npm test src/lib/matcher)
- Report: rule ID, keyword count, overlap connections
