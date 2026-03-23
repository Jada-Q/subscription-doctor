import { describe, it, expect } from "vitest";
import rules from "./rules.json";

describe("rules.json data integrity", () => {
  it("has 100+ rules", () => {
    expect(rules.length).toBeGreaterThanOrEqual(100);
  });

  it("all rules have unique IDs", () => {
    const ids = rules.map((r) => r.id);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups).toEqual([]);
  });

  it("all rules have required fields", () => {
    for (const r of rules) {
      expect(r.id, `missing id`).toBeTruthy();
      expect(r.service, `${r.id}: missing service`).toBeTruthy();
      expect(Array.isArray(r.keywords), `${r.id}: keywords not array`).toBe(true);
      expect(r.keywords.length, `${r.id}: empty keywords`).toBeGreaterThan(0);
      expect(typeof r.appStorePrice, `${r.id}: appStorePrice`).toBe("number");
      expect(typeof r.officialPrice, `${r.id}: officialPrice`).toBe("number");
      expect(r.category, `${r.id}: missing category`).toBeTruthy();
      expect(r.billingCycle, `${r.id}: missing billingCycle`).toBeTruthy();
      expect(Array.isArray(r.overlaps), `${r.id}: overlaps not array`).toBe(true);
      expect(typeof r.advice, `${r.id}: missing advice`).toBe("string");
      expect(Array.isArray(r.alternatives), `${r.id}: alternatives not array`).toBe(true);
    }
  });

  it("all rules have cancelUrl", () => {
    for (const r of rules) {
      expect(r.cancelUrl, `${r.id}: missing cancelUrl`).toBeTruthy();
    }
  });

  it("overlaps are bidirectional", () => {
    const ruleMap = new Map(rules.map((r) => [r.id, r]));
    const errors: string[] = [];
    for (const r of rules) {
      for (const o of r.overlaps) {
        const other = ruleMap.get(o);
        if (!other) {
          errors.push(`${r.id} → ${o}: target does not exist`);
        } else if (!other.overlaps.includes(r.id)) {
          errors.push(`${r.id} → ${o}: not bidirectional`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it("alternatives with 'お得' or price-saving notes should be cheaper", () => {
    // Some alternatives are "upgrade" suggestions (e.g., Apple One bundle)
    // Only validate alternatives that explicitly claim to save money
    for (const r of rules) {
      const servicePrice = Math.max(r.appStorePrice, r.officialPrice);
      if (servicePrice === 0) continue;
      for (const alt of r.alternatives) {
        if (alt.price > 0 && alt.note.match(/お得|安い|回避/)) {
          expect(
            alt.price,
            `${r.id}: alt "${alt.name}" (¥${alt.price}) >= service (¥${servicePrice})`
          ).toBeLessThanOrEqual(servicePrice);
        }
      }
    }
  });

  it("keywords are uppercase (matching convention)", () => {
    for (const r of rules) {
      for (const kw of r.keywords) {
        // Japanese keywords are exempt from uppercase check
        const hasJapanese = /[\u3000-\u9FFF]/.test(kw);
        if (!hasJapanese) {
          expect(kw, `${r.id}: keyword "${kw}" should be uppercase`).toBe(kw.toUpperCase());
        }
      }
    }
  });
});
