import { describe, it, expect } from "vitest";
import { matchTransactions, detectOverlaps, detectCrossCardDuplicates } from "./match";
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

describe("matchTransactions", () => {
  it("matches Netflix by keyword", () => {
    const txs = [makeTx({ description: "NETFLIX", amount: 1590 })];
    const result = matchTransactions(txs);
    expect(result).toHaveLength(1);
    expect(result[0].matchedService).toContain("Netflix");
    expect(result[0].matchType).not.toBe("unmatched");
  });

  it("matches APPLE.COM/BILL", () => {
    const txs = [makeTx({ description: "APPLE.COM/BILL", amount: 1300 })];
    const result = matchTransactions(txs);
    expect(result).toHaveLength(1);
    expect(result[0].matchedService).not.toBeNull();
  });

  it("matches Spotify", () => {
    const txs = [makeTx({ description: "SPOTIFY", amount: 980 })];
    const result = matchTransactions(txs);
    expect(result).toHaveLength(1);
    expect(result[0].matchedService).toContain("Spotify");
  });

  it("returns unmatched for unknown merchants", () => {
    const txs = [makeTx({ description: "RANDOM UNKNOWN SHOP" })];
    const result = matchTransactions(txs);
    expect(result).toHaveLength(1);
    expect(result[0].matchedService).toBeNull();
    expect(result[0].matchType).toBe("unmatched");
  });

  it("calculates Apple tax correctly", () => {
    const txs = [makeTx({ description: "NETFLIX", amount: 1590 })];
    const result = matchTransactions(txs);
    // Netflix: appStorePrice=1590, officialPrice=1490, tax=100
    expect(result[0].appleTaxAmount).toBe(100);
  });

  it("handles partial keyword match", () => {
    const txs = [makeTx({ description: "NETFLIX.COM/BILL SUBSCRIPTION" })];
    const result = matchTransactions(txs);
    expect(result[0].matchedService).toContain("Netflix");
  });

  it("preserves transaction metadata", () => {
    const txs = [makeTx({ date: "03/01", description: "NETFLIX", amount: 1590, rawLine: "03/01 NETFLIX 1590" })];
    const result = matchTransactions(txs);
    expect(result[0].date).toBe("03/01");
    expect(result[0].amount).toBe(1590);
    expect(result[0].rawLine).toBe("03/01 NETFLIX 1590");
  });
});

describe("detectOverlaps", () => {
  it("detects cloud storage overlaps", () => {
    const txs = [
      makeTx({ description: "APPLE.COM/BILL", amount: 1300 }),
      makeTx({ description: "GOOGLE ONE", amount: 250 }),
    ];
    const matched = matchTransactions(txs);
    const overlaps = detectOverlaps(matched);
    // iCloud and Google One should overlap
    expect(overlaps.length).toBeGreaterThanOrEqual(1);
    const group = overlaps[0];
    expect(group.length).toBe(2);
  });

  it("returns empty when no overlaps", () => {
    const txs = [
      makeTx({ description: "NETFLIX", amount: 1590 }),
      makeTx({ description: "SPOTIFY", amount: 980 }),
    ];
    const matched = matchTransactions(txs);
    const overlaps = detectOverlaps(matched);
    expect(overlaps).toHaveLength(0);
  });

  it("ignores unmatched transactions", () => {
    const txs = [
      makeTx({ description: "RANDOM SHOP A" }),
      makeTx({ description: "RANDOM SHOP B" }),
    ];
    const matched = matchTransactions(txs);
    const overlaps = detectOverlaps(matched);
    expect(overlaps).toHaveLength(0);
  });
});

describe("detectCrossCardDuplicates", () => {
  it("detects same service on different cards", () => {
    const txs = [
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 0 }),
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 1 }),
    ];
    const matched = matchTransactions(txs);
    const dups = detectCrossCardDuplicates(matched);
    expect(dups).toHaveLength(1);
    expect(dups[0].instances).toHaveLength(2);
    expect(dups[0].savingsMonthly).toBe(1590);
  });

  it("does not flag same service on same card", () => {
    const txs = [
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 0 }),
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 0 }),
    ];
    const matched = matchTransactions(txs);
    const dups = detectCrossCardDuplicates(matched);
    expect(dups).toHaveLength(0);
  });

  it("ignores unmatched transactions", () => {
    const txs = [
      makeTx({ description: "RANDOM SHOP", cardIndex: 0 }),
      makeTx({ description: "RANDOM SHOP", cardIndex: 1 }),
    ];
    const matched = matchTransactions(txs);
    const dups = detectCrossCardDuplicates(matched);
    expect(dups).toHaveLength(0);
  });

  it("returns empty when no cardIndex set", () => {
    const txs = [
      makeTx({ description: "NETFLIX", amount: 1590 }),
      makeTx({ description: "NETFLIX", amount: 1590 }),
    ];
    const matched = matchTransactions(txs);
    const dups = detectCrossCardDuplicates(matched);
    expect(dups).toHaveLength(0);
  });

  it("detects multiple duplicate services", () => {
    const txs = [
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 0 }),
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 1 }),
      makeTx({ description: "SPOTIFY", amount: 980, cardIndex: 0 }),
      makeTx({ description: "SPOTIFY", amount: 980, cardIndex: 1 }),
    ];
    const matched = matchTransactions(txs);
    const dups = detectCrossCardDuplicates(matched);
    expect(dups).toHaveLength(2);
  });

  it("keeps cheapest instance in savings calculation", () => {
    const txs = [
      makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 0 }),
      makeTx({ description: "NETFLIX", amount: 790, cardIndex: 1 }),
    ];
    const matched = matchTransactions(txs);
    const dups = detectCrossCardDuplicates(matched);
    expect(dups).toHaveLength(1);
    expect(dups[0].savingsMonthly).toBe(1590); // drop the expensive one
    expect(dups[0].totalMonthly).toBe(2380);
  });

  it("passes through cardIndex on matched transactions", () => {
    const txs = [makeTx({ description: "NETFLIX", amount: 1590, cardIndex: 3 })];
    const matched = matchTransactions(txs);
    expect(matched[0].cardIndex).toBe(3);
  });

  it("passes through cardIndex on unmatched transactions", () => {
    const txs = [makeTx({ description: "RANDOM UNKNOWN SHOP", cardIndex: 2 })];
    const matched = matchTransactions(txs);
    expect(matched[0].cardIndex).toBe(2);
  });
});
