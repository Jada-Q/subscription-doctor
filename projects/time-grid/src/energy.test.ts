import { describe, expect, it } from "vitest";
import {
  EARLY_BIRD,
  NIGHT_OWL,
  TEMPLATES,
  avgEnergy,
  energyAtHour,
  energyAtSlot,
} from "./energy.ts";
import { DEFAULT_CONFIG, at } from "./types.ts";

describe("energy curve interpolation", () => {
  it("控制点处取精确值", () => {
    expect(energyAtHour(EARLY_BIRD, 9)).toBe(85);
    expect(energyAtHour(NIGHT_OWL, 22)).toBe(85);
  });

  it("控制点之间线性插值", () => {
    // EARLY_BIRD: 6h=30 → 8h=70，7h 应为 50
    expect(energyAtHour(EARLY_BIRD, 7)).toBeCloseTo(50);
  });

  it("首尾按端点值延伸，且全程在 [0,100]", () => {
    for (const curve of TEMPLATES) {
      for (let h = 0; h <= 24; h += 0.25) {
        const e = energyAtHour(curve, h);
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(100);
      }
    }
  });

  it("早鸟上午精力显著高于夜猫上午", () => {
    expect(energyAtHour(EARLY_BIRD, 9.5)).toBeGreaterThan(
      energyAtHour(NIGHT_OWL, 9.5) + 30,
    );
  });

  it("energyAtSlot 每天重复同一条曲线", () => {
    const cfg = DEFAULT_CONFIG;
    expect(energyAtSlot(EARLY_BIRD, at(0, 9), cfg)).toBeCloseTo(
      energyAtSlot(EARLY_BIRD, at(3, 9), cfg),
    );
  });

  it("avgEnergy 在高能区间高于低能区间", () => {
    const cfg = DEFAULT_CONFIG;
    const high = avgEnergy(EARLY_BIRD, at(0, 9), at(0, 11), cfg);
    const low = avgEnergy(EARLY_BIRD, at(0, 21), at(0, 23), cfg);
    expect(high).toBeGreaterThan(low);
  });
});
