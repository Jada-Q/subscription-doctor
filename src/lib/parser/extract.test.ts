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
});
