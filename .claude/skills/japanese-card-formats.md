# Japanese credit card statement formats

## 共通点
- 日付: MM/DD 或 YYYY/MM/DD
- 全角数字常見: ０１２３ → 需要normalize
- 回払い（分割払い）行: 包含原始日期，需要date backfill

## カード別特徴
- 楽天カード: "ご利用日 ご利用先 ご利用金額" header, リボ行容易误检
- 三井住友: 独特の日付格式, VISAタッチ決済有特殊標記
- JCB: 海外利用に現地通貨表示あり
- AMEX: 英語表記が多い
- EPOSカード: マルイ系, "ご利用日 ご利用店名 ご利用金額" format, ポイント行が混在

## 添加新カード対応时
1. 收集3-5张该卡的实际截图
2. 跑OCR看原始输出
3. 在extract.ts里加format-specific parsing if needed
4. 在rules.json里加该卡常见的订阅服务keywords
