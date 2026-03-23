import { describe, it, expect } from "vitest";
import { matchTransactions, detectOverlaps, getRules } from "./match";
import type { ParsedTransaction } from "../parser/types";

function makeTx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    date: "02/15",
    description: "SOME MERCHANT",
    amount: 1000,
    rawLine: "02/15 SOME MERCHANT 1000",
    isLikelySubscription: false,
    ...overrides,
  };
}

describe("rules validation via matcher", () => {
  const rules = getRules();

  it("every rule is matchable by at least one of its own keywords", () => {
    const unmatchable: string[] = [];
    for (const rule of rules) {
      let matched = false;
      for (const keyword of rule.keywords) {
        const amount = rule.amounts.length > 0 ? rule.amounts[0] : 1000;
        const txs = [makeTx({ description: keyword, amount })];
        const results = matchTransactions(txs);
        if (results[0].matchedRule?.id === rule.id) {
          matched = true;
          break;
        }
      }
      if (!matched) unmatchable.push(rule.id);
    }
    expect(unmatchable, `These rules cannot be matched by their own keywords: ${unmatchable.join(", ")}`).toEqual([]);
  });

  it("APPLE COM BILL disambiguates iCloud plans by amount", () => {
    const plans = [
      { amount: 130, expectedId: "icloud_50gb" },
      { amount: 400, expectedId: "icloud_200gb" },
      { amount: 1300, expectedId: "icloud_2tb" },
      { amount: 3900, expectedId: "icloud_6tb" },
    ];
    for (const { amount, expectedId } of plans) {
      const txs = [makeTx({ description: "APPLE COM BILL", amount })];
      const results = matchTransactions(txs);
      expect(results[0].matchedRule?.id, `amount ¥${amount}`).toBe(expectedId);
    }
  });

  it("detects Apple tax correctly for known services", () => {
    const appleTaxServices = rules.filter(
      (r) => r.appStorePrice > 0 && r.officialPrice > 0 && r.appStorePrice > r.officialPrice
    );
    expect(appleTaxServices.length).toBeGreaterThan(0);

    for (const rule of appleTaxServices) {
      const keyword = rule.keywords[0];
      const amount = rule.appStorePrice;
      const txs = [makeTx({ description: keyword, amount })];
      const results = matchTransactions(txs);
      const matched = results.find((r) => r.matchedRule?.id === rule.id);
      if (matched) {
        expect(
          matched.appleTaxAmount,
          `${rule.id}: Apple tax should be ¥${rule.appStorePrice - rule.officialPrice}`
        ).toBe(rule.appStorePrice - rule.officialPrice);
      }
    }
  });

  it("overlap groups form connected components", () => {
    // Simulate having all overlapping services matched
    const musicRules = rules.filter((r) => r.category === "music" && r.overlaps.length > 0);
    if (musicRules.length < 2) return;

    const txs = musicRules.map((r) =>
      makeTx({
        description: r.keywords[0],
        amount: r.amounts[0] || 1000,
      })
    );
    const matched = matchTransactions(txs);
    const overlaps = detectOverlaps(matched);

    // Should detect at least one overlap group among music services
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it("no false positives on common Japanese merchant names", () => {
    const commonMerchants = [
      "イオンモール幕張",
      "ファミリーマート新宿店",
      "ローソン渋谷店",
      "マクドナルド品川店",
      "ユニクロ銀座店",
      "東京電力",
      "東京ガス",
    ];
    for (const merchant of commonMerchants) {
      const txs = [makeTx({ description: merchant, amount: 2000 })];
      const results = matchTransactions(txs);
      expect(
        results[0].matchedService,
        `"${merchant}" should NOT match any subscription`
      ).toBeNull();
    }
  });

  it("Japanese keywords match correctly", () => {
    const japaneseKeywordRules = rules.filter((r) =>
      r.keywords.some((kw) => /[\u3000-\u9FFF]/.test(kw))
    );
    expect(japaneseKeywordRules.length).toBeGreaterThan(0);

    // Test a few known Japanese keyword matches
    const nuro = [makeTx({ description: "NURO光ご利用料金", amount: 5200 })];
    const nuroResult = matchTransactions(nuro);
    expect(nuroResult[0].matchedRule?.id).toBe("nuro_hikari");

    const docomo = [makeTx({ description: "ドコモ光", amount: 5000 })];
    const docomoResult = matchTransactions(docomo);
    expect(docomoResult[0].matchedRule?.id).toBe("docomo_hikari");
  });

  it("APPLECOMBILL (no spaces, PaddleOCR artifact) matches iCloud plans", () => {
    const plans = [
      { amount: 130, expectedId: "icloud_50gb" },
      { amount: 400, expectedId: "icloud_200gb" },
      { amount: 1300, expectedId: "icloud_2tb" },
    ];
    for (const { amount, expectedId } of plans) {
      const txs = [makeTx({ description: "APPLECOMBILL", amount })];
      const results = matchTransactions(txs);
      expect(results[0].matchedRule?.id, `APPLECOMBILL ¥${amount}`).toBe(expectedId);
    }
  });
});
