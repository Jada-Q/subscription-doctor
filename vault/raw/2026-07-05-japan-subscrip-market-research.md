# 日本サブスク管理市場調査 2025-2026

調査日: 2026-07-05
手法: 5方向並行検索 → 15ソース取得 → 3票制adversarial検証
結果: 8件確認 / 2件否定 / 0件未検証
過期日: 2026-10-05

---

## Summary

米国大手（Rocket Money/Trim）は日本未参入。マネーフォワードME・Zaimが銀行口座連携型サブスク管理を提供済み。日本発新規としてCostly（プライバシーファースト）とUPDEITOが登場。Apple MSCA法は2025-12-18施行済みだが実質削減は30%→26%の4%にとどまり業界から批判。消費者の約70%がコストを理由にサブスク解約検討 — Subscription Doctorにとって追い風。

---

## 確認済み Findings（全て3-0または2-1で通過）

### 1. 米国プレイヤー日本未参入（confidence: high, vote: 3-0）

Rocket Money公式ヘルプ（2026年4月更新）: "Rocket Money does not support international banks at this time, and is only available to users located within the United States with U.S. based banks"。Plaidベースの米国金融インフラに依存。Trim（現Rocket Money）も同様。国際展開計画なし。

**→ Subscription Doctorへの影響: 米国大手との直接競合リスクは当面低い。**

出典: https://help.rocketmoney.com/en/articles/79778-does-rocket-money-support-international-banks

### 2. マネーフォワードME サブスクレポート機能（confidence: high, vote: 3-0）

- 2022年12月にサブスクレポート機能追加（プレミアム限定）
- 2025年8月5日にプレミアム料金改定: クレカ決済 月額540円 / App Store・Google Play決済 月額590円
- ストア経由 vs 直接決済で月額50円の「Apple税/Google税」価格差が可視化されている
- 銀行口座連携型 → Subscription DoctorのOCR・データ非送信型とは根本的に異なるアプローチ

**→ 競合だが差別化は明確。MFのストア手数料転嫁は我々の「Apple税検出」のvalidation。**

出典:

- https://corp.moneyforward.com/news/info/20250701-mf-press-2/
- https://www.watch.impress.co.jp/docs/news/1463008.html
- https://prtimes.jp/main/html/rd/p/000000965.000008962.html

### 3. Zaim「定額サービスチェッカー」（confidence: high, vote: 3-0）

- 2020年6月30日公開、全ユーザー無料
- 家計簿に記録された過去データから動画・音楽等のサブスクを自動検出
- 支払金額・期日・契約プランを予測、月額合計を可視化
- 1,000万DL超（くふうカンパニー）、1,300以上の金融機関と連携
- 銀行口座・クレカ連携を前提とするサーバーサイド型

**→ 最も近い既存競合。差別化ポイント: データが端末を離れない＋口座連携不要。**

出典:

- https://content.zaim.net/flatrates
- https://prtimes.jp/main/html/rd/p/000000025.000046400.html

### 4. 新規参入: Costly & UPDEITO（confidence: high, vote: 3-0）

**Costly**（開発者: YUUSUI KASHIWAGI）:

- プライバシーファースト設計 — データはiPhoneローカルのみ、外部サーバー不使用
- 有料プラン: 月額200円/年額1,800円
- 朝日新聞デジタル等37以上の日本メディアで紹介
- App Store ID: 6738356072

**UPDEITO サブスク管理アプリ**:

- 広告なし・ペイウォールなし
- iOS ID: 6547839073 / Android: jp.co.updeito.subscapp

**→ Costlyが最も近い競合（プライバシーファースト）。ただしネイティブiOSアプリの手動入力型 vs 我々のWebベースOCR自動検出型。DL数・市場シェアは未確認。**

出典: App Store / Google Play listing

### 5. MSCA法施行と手数料体系（confidence: high, vote: 3-0）

- 2025年12月18日施行。iOS 26.2で対応
- 代替アプリマーケットプレイス、サードパーティ決済、代替ブラウザエンジンを日本で解禁
- App Store標準コミッション: 21%（+ Apple IAP利用時は決済処理手数料5% = 合計26%）
- 従来30%からの実質4%削減にとどまる
- Small Business Program参加者と2年目以降サブスク: 基本10%（従来15%から）
- 代替マーケットプレイス経由: Core Technology Commission 5%

**→ PROJECT_PLAN記載の「10-15%」は不正確。実態は21%+5%=26%。Apple税検出機能の訴求は引き続き有効。**

出典:

- https://www.apple.com/newsroom/2025/12/apple-announces-changes-to-ios-in-japan/
- https://developer.apple.com/support/app-distribution-in-japan/

### 6. 業界団体の批判声明（confidence: high, vote: 3-0）

2026年2月、IT関連7業界団体（600社超、MCF等）がAppleの代替決済手数料撤廃を要求する緊急共同声明。「経済的インセンティブがない」と批判。

**→ Apple税問題は政治的にもアクティブ。マーケティング素材として使える。**

出典:

- https://9to5mac.com/2026/02/10/japan-tech-groups-say-apples-new-payment-rules-are-not-a-viable-option-for-developers/
- https://mcf.or.jp/newsletter/20260205-41651

### 7. 消費者の約70%がコストを理由に解約検討（confidence: high, vote: 3-0）

- Appliv調査（2024年2月, n=605）: 解約検討者69.4%、理由1位「節約のため」
- アスマーク調査（2025年1月, n=800）: エンタメ分野解約者の7割超がコスト理由
- 「自分好みのカスタマイズ」「利用状況に応じた柔軟な料金設定」への要望
- 物価高騰の影響が示唆

**→ 「節約額可視化」機能への市場ニーズを裏付け。**

出典:

- https://prtimes.jp/main/html/rd/p/000000491.000055900.html
- https://prtimes.jp/main/html/rd/p/000000521.000018991.html

### 8. サブスク見直し頻度と未利用実態（confidence: medium, vote: 見直し頻度3-0, 未利用割合2-1）

- 1年以内に見直す人: 約半数
- 1年以上見直していない人: 約3割
- 未利用サブスク保有の自己申告: 7.75%（バリューファースト調査, n=400）
- 別調査では53%（NilCraft 2026年4月）— 大きな乖離あり、自己認識バイアスの可能性

**→ 「気づいていない無駄」の可視化こそ Subscription Doctor の価値。**

出典: https://manamina.valuesccg.com/articles/4419

---

## 否定された Claims（skeptic agentが否定）

1. **UPDEITOの「AIナビゲーション」機能** — vote: 1-2で否定。実際にはAI搭載の証拠なし。
2. **「解約者の約6割が年間約10,000円節約」** — vote: 0-3で否定。元調査データの誤読。

---

## 注意事項

1. 消費者調査は2024年2月〜2025年8月の範囲。最新2026年データは限定的
2. インターネットパネル調査 → デジタルリテラシー高い層に偏り
3. MSCA施行後半年 — 代替決済の実際の採用率はデータ不足
4. B2B向けSaaS管理ツール、LINE/PayPay等の決済プラットフォームは未調査
5. Costlyの市場シェア・DL数は未確認

---

## 未調査の重要問題

1. LINE Pay/PayPay/楽天ペイのサブスク管理機能追加の有無
2. MSCA施行後、代替決済を実際に採用した日本の主要開発者
3. freeeの個人向けサブスク管理機能の有無
4. 金融庁/デジタル庁のオープンバンキング規制の進展
