import { describe, it, expect } from "vitest";
import { generateReport, gradeLabel, gradeEmoji } from "./score";
import type { MatchedTransaction } from "../matcher/types";

function makeTx(overrides: Partial<MatchedTransaction> = {}): MatchedTransaction {
  return {
    date: "02/15",
    description: "TEST",
    amount: 1000,
    matchedService: "Test Service",
    matchedRule: null,
    matchType: "keyword_exact",
    appleTaxAmount: 0,
    billingCycle: "monthly",
    rawLine: "02/15 TEST ¥1,000",
    ...overrides,
  };
}

describe("generateReport", () => {
  it("returns score 100 with no penalties", () => {
    const matched = [makeTx(), makeTx({ amount: 500 })];
    const report = generateReport(matched, []);
    expect(report.score).toBe(100);
    expect(report.grade).toBe("green");
    expect(report.totalMonthly).toBe(1500);
    expect(report.totalAnnual).toBe(18000);
  });

  it("deducts 5 points per Apple tax item", () => {
    const matched = [
      makeTx({ appleTaxAmount: 100 }),
      makeTx({ appleTaxAmount: 200 }),
    ];
    const report = generateReport(matched, []);
    // -5 * 2 items = -10, -floor(300/500) = -0 → score 90
    expect(report.score).toBe(90);
    expect(report.appleTaxItems.length).toBe(2);
    expect(report.appleTaxTotal).toBe(300);
  });

  it("deducts 1 point per ¥500 of Apple tax", () => {
    const matched = [makeTx({ appleTaxAmount: 1500 })];
    const report = generateReport(matched, []);
    // -5 (1 item) - 3 (floor(1500/500)) = 92
    expect(report.score).toBe(92);
  });

  it("deducts 10 points per overlap group", () => {
    const tx1 = makeTx({ amount: 980 });
    const tx2 = makeTx({ amount: 1280 });
    const report = generateReport([tx1, tx2], [[tx1, tx2]]);
    expect(report.score).toBe(90);
    expect(report.overlaps.length).toBe(1);
  });

  it("calculates overlap savings (drop most expensive)", () => {
    const tx1 = makeTx({ amount: 500 });
    const tx2 = makeTx({ amount: 1200 });
    const report = generateReport([tx1, tx2], [[tx1, tx2]]);
    expect(report.savingsMonthly).toBe(1200); // drop the more expensive one
    expect(report.savingsAnnual).toBe(14400);
  });

  it("floors score at 0", () => {
    const matched = Array.from({ length: 25 }, () => makeTx({ appleTaxAmount: 500 }));
    const report = generateReport(matched, []);
    expect(report.score).toBe(0);
    expect(report.grade).toBe("red");
  });

  it("counts matched and unmatched correctly", () => {
    const matched = [
      makeTx({ matchedService: "Netflix" }),
      makeTx({ matchedService: null }),
      makeTx({ matchedService: null }),
    ];
    const report = generateReport(matched, []);
    expect(report.matchedCount).toBe(1);
    expect(report.unmatchedCount).toBe(2);
    expect(report.totalCount).toBe(3);
  });

  it("does not penalize unmatched items in score", () => {
    const matched = [
      makeTx({ matchedService: null }),
      makeTx({ matchedService: null }),
      makeTx({ matchedService: null }),
    ];
    const report = generateReport(matched, []);
    expect(report.score).toBe(100);
  });

  it("deducts 15 points per cross-card duplicate", () => {
    const matched = [makeTx(), makeTx()];
    const crossCardDuplicates = [
      {
        ruleId: "netflix_premium",
        serviceName: "Netflix (Premium)",
        instances: matched,
        totalMonthly: 2000,
        savingsMonthly: 1000,
      },
    ];
    const report = generateReport(matched, [], crossCardDuplicates);
    expect(report.score).toBe(85); // 100 - 15
    expect(report.crossCardDuplicates).toHaveLength(1);
  });

  it("includes cross-card savings in total savings", () => {
    const matched = [makeTx(), makeTx()];
    const crossCardDuplicates = [
      {
        ruleId: "netflix_premium",
        serviceName: "Netflix (Premium)",
        instances: matched,
        totalMonthly: 3180,
        savingsMonthly: 1590,
      },
    ];
    const report = generateReport(matched, [], crossCardDuplicates);
    expect(report.crossCardSavingsMonthly).toBe(1590);
    expect(report.crossCardSavingsAnnual).toBe(19080);
    expect(report.savingsMonthly).toBe(1590); // only cross-card savings (no apple tax or overlaps)
  });

  it("works without cross-card duplicates (backward compat)", () => {
    const matched = [makeTx()];
    const report = generateReport(matched, []);
    expect(report.crossCardDuplicates).toHaveLength(0);
    expect(report.crossCardSavingsMonthly).toBe(0);
    expect(report.cardCount).toBe(1);
  });

  it("calculates cardCount from transactions", () => {
    const matched = [
      makeTx({ cardIndex: 0 }),
      makeTx({ cardIndex: 1 }),
      makeTx({ cardIndex: 2 }),
    ];
    const report = generateReport(matched, []);
    expect(report.cardCount).toBe(3);
  });
});

describe("gradeLabel", () => {
  it("returns Japanese labels", () => {
    expect(gradeLabel("green")).toBe("良好");
    expect(gradeLabel("yellow")).toBe("要注意");
    expect(gradeLabel("red")).toBe("要改善");
  });
});

describe("gradeEmoji", () => {
  it("returns correct emoji", () => {
    expect(gradeEmoji("green")).toBe("🟢");
    expect(gradeEmoji("yellow")).toBe("🟡");
    expect(gradeEmoji("red")).toBe("🔴");
  });
});
