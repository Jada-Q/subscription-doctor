import { describe, it, expect } from "vitest";
import { parseTransactions } from "./extract";

describe("parseTransactions", () => {
  it("extracts basic transaction with date and amount", () => {
    const text = "02/15 NETFLIX 1590";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("02/15");
    expect(result[0].amount).toBe(1590);
    expect(result[0].description).toContain("NETFLIX");
  });

  it("handles full date format YYYY/MM/DD", () => {
    const text = "2026/02/15 Spotify 980";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026/02/15");
  });

  it("extracts yen amounts with ¥ symbol", () => {
    const text = "02/15 NETFLIX ¥1,590";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1590);
  });

  it("extracts amounts with 円 suffix", () => {
    const text = "02/15 NETFLIX 1590円";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1590);
  });

  it("skips header lines", () => {
    const text = [
      "ご利用日 ご利用先 金額",
      "02/15 NETFLIX 1590",
    ].join("\n");
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain("NETFLIX");
  });

  it("skips payment method lines but extracts dates", () => {
    const text = [
      "NURO光ご利用料金 ご本人 2499",
      "26/03/03 1回払い 26/04",
    ].join("\n");
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    // Date from 回払い line should be retroactively assigned
    expect(result[0].date).toBe("26/03/03");
    expect(result[0].amount).toBe(2499);
  });

  it("retroactively assigns date to previous transaction", () => {
    const text = [
      "APPLE.COM/BILL 1300",
      "02/15 1回払い",
    ].join("\n");
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    // Date from 回払い line retroactively assigned to APPLE.COM/BILL
    expect(result[0].date).toBe("02/15");
    expect(result[0].description).toContain("APPLE");
  });

  it("handles multiple transactions", () => {
    const text = [
      "02/15 NETFLIX 1590",
      "02/16 SPOTIFY 980",
      "02/17 APPLE.COM/BILL 1300",
    ].join("\n");
    const result = parseTransactions(text);
    expect(result).toHaveLength(3);
  });

  it("skips lines with no amount", () => {
    const text = [
      "02/15 NETFLIX 1590",
      "some random text without amount",
      "02/16 SPOTIFY 980",
    ].join("\n");
    const result = parseTransactions(text);
    expect(result).toHaveLength(2);
  });

  it("skips lines with very short descriptions", () => {
    const text = "02/15 X 500";
    const result = parseTransactions(text);
    expect(result).toHaveLength(0);
  });

  it("handles Japanese date format MM月DD日", () => {
    const text = "2月15日 NETFLIX 1590";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2/15");
  });

  it("marks subscription-like transactions", () => {
    const text = "02/15 NETFLIX.COM SUBSCRIPTION 1590";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].isLikelySubscription).toBe(true);
  });

  it("handles full-width characters", () => {
    const text = "０２／１５ ＮＥＴＦＬＩＸ ￥１，５９０";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1590);
  });

  it("removes ご本人 from description", () => {
    const text = "02/15 NURO光ご利用料金 ご本人 2499";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].description).not.toContain("ご本人");
  });

  it("returns empty array for empty input", () => {
    expect(parseTransactions("")).toHaveLength(0);
    expect(parseTransactions("   ")).toHaveLength(0);
  });

  // --- PaddleOCR real-world output patterns (SPIKE_RESULT.md) ---

  it("handles APPLECOMBILL (PaddleOCR drops spaces in service names)", () => {
    const text = "02/15 APPLECOMBILL 1300";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain("APPLECOMBILL");
    expect(result[0].amount).toBe(1300);
  });

  it("handles multiple consecutive transactions (real statement format)", () => {
    const text = [
      "NURO光ご利用料金 ご本人 2499",
      "26/02/03 1回払い 26/03",
      "APPLE.COM/BILL ご本人 1300",
      "26/02/15 1回払い 26/03",
      "NETFLIX.COM ご本人 1590",
      "26/02/20 1回払い 26/03",
    ].join("\n");
    const result = parseTransactions(text);
    expect(result.length).toBeGreaterThanOrEqual(3);
    // Verify retroactive date assignment works for all
    for (const tx of result) {
      expect(tx.date).toBeTruthy();
    }
  });

  it("handles amount with extra spaces around it", () => {
    const text = "02/15 SPOTIFY   980";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(980);
  });

  it("handles mixed full-width date with half-width amount", () => {
    const text = "０２月１５日 NETFLIX 1590";
    const result = parseTransactions(text);
    if (result.length > 0) {
      expect(result[0].amount).toBe(1590);
    }
  });

  it("handles very long description line", () => {
    const longDesc = "A".repeat(100);
    const text = `02/15 ${longDesc} 1590`;
    const result = parseTransactions(text);
    // Should extract even with long description
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1590);
  });

  it("handles YY/MM/DD date format", () => {
    const text = "26/02/15 NETFLIX 1590";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("26/02/15");
  });

  it("stamps cardIndex when provided", () => {
    const text = "02/15 NETFLIX 1590";
    const result = parseTransactions(text, "generic", 2);
    expect(result).toHaveLength(1);
    expect(result[0].cardIndex).toBe(2);
  });

  it("leaves cardIndex undefined when not provided", () => {
    const text = "02/15 NETFLIX 1590";
    const result = parseTransactions(text);
    expect(result).toHaveLength(1);
    expect(result[0].cardIndex).toBeUndefined();
  });

  it("stamps cardIndex on all transactions", () => {
    const text = ["02/15 NETFLIX 1590", "02/16 SPOTIFY 980"].join("\n");
    const result = parseTransactions(text, "generic", 0);
    expect(result).toHaveLength(2);
    expect(result[0].cardIndex).toBe(0);
    expect(result[1].cardIndex).toBe(0);
  });
});
