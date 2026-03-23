import { describe, it, expect } from "vitest";

/**
 * Test the image scaling logic used in fileToImageInput.
 * We extract the pure math from engine.ts and test it directly,
 * since the full function depends on DOM APIs (Canvas, Image, URL).
 */

const MAX_DIMENSION = 1600;

function computeScaledDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  return { width, height };
}

describe("OCR image scaling logic", () => {
  it("preserves dimensions for small images (800x600)", () => {
    const { width, height } = computeScaledDimensions(800, 600);
    expect(width).toBe(800);
    expect(height).toBe(600);
  });

  it("preserves dimensions at exactly MAX_DIMENSION (1600x1200)", () => {
    const { width, height } = computeScaledDimensions(1600, 1200);
    expect(width).toBe(1600);
    expect(height).toBe(1200);
  });

  it("scales down landscape images exceeding MAX_DIMENSION", () => {
    // 3200x2400 → scale = 1600/3200 = 0.5
    const { width, height } = computeScaledDimensions(3200, 2400);
    expect(width).toBe(1600);
    expect(height).toBe(1200);
  });

  it("scales down portrait images (iPhone screenshot 1170x2222)", () => {
    // 2222 is max → scale = 1600/2222 ≈ 0.72
    const { width, height } = computeScaledDimensions(1170, 2222);
    expect(width).toBe(Math.round(1170 * (1600 / 2222)));
    expect(height).toBe(1600);
  });

  it("scales down square images", () => {
    const { width, height } = computeScaledDimensions(3200, 3200);
    expect(width).toBe(1600);
    expect(height).toBe(1600);
  });

  it("preserves 1x1 tiny images", () => {
    const { width, height } = computeScaledDimensions(1, 1);
    expect(width).toBe(1);
    expect(height).toBe(1);
  });

  it("handles edge case: width at MAX, height exceeds", () => {
    // 1600x3200 → max is height → scale = 1600/3200 = 0.5
    const { width, height } = computeScaledDimensions(1600, 3200);
    expect(width).toBe(800);
    expect(height).toBe(1600);
  });

  it("maintains aspect ratio for very large images", () => {
    const originalW = 4032;
    const originalH = 3024;
    const { width, height } = computeScaledDimensions(originalW, originalH);
    const originalRatio = originalW / originalH;
    const scaledRatio = width / height;
    // Allow small rounding error
    expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.01);
  });
});
