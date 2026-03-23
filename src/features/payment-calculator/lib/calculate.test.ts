import { describe, it, expect } from "vitest";
import { calculateBestPayment } from "./calculate";
import { PAYMENT_TEMPLATES } from "../data/templates";

describe("calculateBestPayment", () => {
  const allMethods = PAYMENT_TEMPLATES;
  const ownAll = new Set(allMethods.map((m) => m.id));

  it("ranks 三井住友NL first for convenience store purchases", () => {
    const results = calculateBestPayment("convenience", 1000, allMethods, ownAll);
    expect(results[0].method.id).toBe("smbc_nl");
    expect(results[0].effectiveRate).toBe(0.07);
    expect(results[0].cashback).toBe(70);
  });

  it("ranks 三井住友NL first for restaurant purchases", () => {
    const results = calculateBestPayment("restaurant", 3000, allMethods, ownAll);
    expect(results[0].method.id).toBe("smbc_nl");
    expect(results[0].cashback).toBe(210);
  });

  it("ranks PayPayカード first for online purchases (5%)", () => {
    const results = calculateBestPayment("online", 10000, allMethods, ownAll);
    expect(results[0].method.id).toBe("paypay_card");
    expect(results[0].effectiveRate).toBe(0.05);
    expect(results[0].cashback).toBe(500);
  });

  it("returns 1% cards tied for 'other' category", () => {
    const results = calculateBestPayment("other", 5000, allMethods, ownAll);
    // All 1% cards should have cashback = 50
    const top = results.filter((r) => r.cashback === 50);
    expect(top.length).toBe(4); // rakuten, jcb, paypay, d_card
  });

  it("floors cashback to integer", () => {
    const results = calculateBestPayment("other", 333, allMethods, ownAll);
    // 333 * 0.01 = 3.33 → floor to 3
    const onePercent = results.find((r) => r.method.id === "rakuten_card");
    expect(onePercent?.cashback).toBe(3);
  });

  it("marks unowned cards correctly", () => {
    const ownedOnly = new Set(["rakuten_card"]);
    const results = calculateBestPayment("convenience", 1000, allMethods, ownedOnly);
    const rakuten = results.find((r) => r.method.id === "rakuten_card");
    const smbc = results.find((r) => r.method.id === "smbc_nl");
    expect(rakuten?.isOwned).toBe(true);
    expect(smbc?.isOwned).toBe(false);
  });

  it("uses campaign rate when active", () => {
    const methodsWithCampaign = allMethods.map((m) =>
      m.id === "d_card"
        ? {
            ...m,
            campaigns: [
              {
                description: "ドラッグストア20%還元",
                category: "drugstore" as const,
                rate: 0.2,
                endDate: "2099-12-31",
              },
            ],
          }
        : m
    );
    const results = calculateBestPayment("drugstore", 1000, methodsWithCampaign, ownAll);
    expect(results[0].method.id).toBe("d_card");
    expect(results[0].cashback).toBe(200);
    expect(results[0].rateSources).toContain("キャンペーン");
  });

  it("ignores expired campaigns", () => {
    const methodsWithExpired = allMethods.map((m) =>
      m.id === "d_card"
        ? {
            ...m,
            campaigns: [
              {
                description: "終了済み",
                category: "drugstore" as const,
                rate: 0.5,
                endDate: "2020-01-01",
              },
            ],
          }
        : m
    );
    const results = calculateBestPayment("drugstore", 1000, methodsWithExpired, ownAll);
    const dcard = results.find((r) => r.method.id === "d_card");
    expect(dcard?.effectiveRate).toBe(0.04); // category rate (drugstore), not expired campaign
  });
});
