import { describe, it, expect } from "vitest";
import { generateDemoResult } from "./data";

describe("generateDemoResult", () => {
  const demo = generateDemoResult();

  it("returns a valid report with score 0-100", () => {
    expect(demo.report.score).toBeGreaterThanOrEqual(0);
    expect(demo.report.score).toBeLessThanOrEqual(100);
    expect(["green", "yellow", "red"]).toContain(demo.report.grade);
  });

  it("contains demo transactions", () => {
    expect(demo.transactions.length).toBeGreaterThan(0);
    expect(demo.transactions.some((t) => t.description === "SPOTIFY")).toBe(true);
    expect(demo.transactions.some((t) => t.description === "NETFLIX")).toBe(true);
  });

  it("detects Apple tax in demo data", () => {
    // Netflix via App Store (¥1,590) vs official (¥1,490) = ¥100 Apple tax
    // Spotify via App Store (¥1,280) vs official (¥980) = ¥300 Apple tax
    expect(demo.report.appleTaxItems.length).toBeGreaterThan(0);
    expect(demo.report.appleTaxTotal).toBeGreaterThan(0);
  });

  it("detects overlaps (Spotify + YouTube Premium)", () => {
    expect(demo.report.overlaps.length).toBeGreaterThan(0);
  });

  it("matches NURO光 as internet service", () => {
    const nuro = demo.report.allTransactions.find(
      (t) => t.matchedRule?.id === "nuro_hikari"
    );
    expect(nuro).toBeDefined();
    expect(nuro?.matchedRule?.category).toBe("internet");
  });

  it("leaves non-subscription items unmatched", () => {
    const konbini = demo.report.allTransactions.find(
      (t) => t.description === "セブンイレブン赤坂店"
    );
    expect(konbini?.matchedService).toBeNull();
  });

  it("returns valid OCR result shape", () => {
    expect(demo.ocrResult.text).toBeTruthy();
    expect(demo.ocrResult.lines.length).toBe(demo.transactions.length);
    expect(demo.ocrResult.avgConfidence).toBe(0.95);
    expect(demo.ocrResult.duration).toBe(0);
  });

  it("calculates savings potential", () => {
    expect(demo.report.savingsMonthly).toBeGreaterThan(0);
    expect(demo.report.savingsAnnual).toBe(demo.report.savingsMonthly * 12);
  });

  it("detects cross-card duplicates (Netflix + Amazon Prime on 2 cards)", () => {
    expect(demo.report.crossCardDuplicates.length).toBeGreaterThanOrEqual(2);
    const netflixDup = demo.report.crossCardDuplicates.find(
      (d) => d.serviceName.includes("Netflix")
    );
    expect(netflixDup).toBeDefined();
    expect(netflixDup!.instances.length).toBe(2);
  });

  it("reports cardCount of 2 in demo", () => {
    expect(demo.report.cardCount).toBe(2);
  });

  it("includes cross-card savings", () => {
    expect(demo.report.crossCardSavingsMonthly).toBeGreaterThan(0);
    expect(demo.report.crossCardSavingsAnnual).toBe(
      demo.report.crossCardSavingsMonthly * 12
    );
  });
});
