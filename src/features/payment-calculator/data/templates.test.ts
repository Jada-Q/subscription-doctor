import { describe, it, expect } from "vitest";
import { PAYMENT_TEMPLATES, MERCHANT_CATEGORIES } from "./templates";

describe("PAYMENT_TEMPLATES", () => {
  it("has at least 5 card templates", () => {
    expect(PAYMENT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("all templates have unique IDs", () => {
    const ids = PAYMENT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all templates have required fields", () => {
    for (const t of PAYMENT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(["credit", "debit", "ewallet"]).toContain(t.type);
      expect(t.baseRate).toBeGreaterThan(0);
      expect(t.baseRate).toBeLessThanOrEqual(0.1);
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(Array.isArray(t.categoryRates)).toBe(true);
      expect(Array.isArray(t.campaigns)).toBe(true);
    }
  });

  it("category rates reference valid merchant categories", () => {
    const validCats = new Set(MERCHANT_CATEGORIES.map((c) => c.id));
    for (const t of PAYMENT_TEMPLATES) {
      for (const cr of t.categoryRates) {
        expect(validCats.has(cr.category)).toBe(true);
      }
    }
  });

  it("category rates are higher than base rates", () => {
    for (const t of PAYMENT_TEMPLATES) {
      for (const cr of t.categoryRates) {
        expect(cr.rate).toBeGreaterThan(t.baseRate);
      }
    }
  });
});

describe("MERCHANT_CATEGORIES", () => {
  it("has 8 categories", () => {
    expect(MERCHANT_CATEGORIES.length).toBe(8);
  });

  it("all categories have unique IDs", () => {
    const ids = MERCHANT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all categories have label and icon", () => {
    for (const c of MERCHANT_CATEGORIES) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.icon).toBeTruthy();
    }
  });
});
