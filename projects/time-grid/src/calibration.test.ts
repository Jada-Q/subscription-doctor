import { describe, expect, it } from "vitest";
import { EARLY_BIRD } from "./energy.ts";
import { energyAtHour } from "./energy.ts";
import {
  RATING_ENERGY,
  applyFeedback,
  calibratedCurve,
  emptyCalibration,
} from "./calibration.ts";

describe("calibration", () => {
  it("首个样本直接落桶，之后 EMA 更新", () => {
    let c = emptyCalibration();
    c = applyFeedback(c, 21, 3); // 21 点 🔥
    expect(c.buckets[21]).toBe(RATING_ENERGY[3]);
    c = applyFeedback(c, 21, 1); // 再来一次 🥱
    expect(c.buckets[21]).toBeCloseTo(0.7 * 85 + 0.3 * 25);
    expect(c.total).toBe(2);
    expect(c.counts[21]).toBe(2);
  });

  it("不可变更新：原对象不被修改", () => {
    const c0 = emptyCalibration();
    const c1 = applyFeedback(c0, 9, 3);
    expect(c0.total).toBe(0);
    expect(c0.buckets[9]).toBeNull();
    expect(c1.total).toBe(1);
  });

  it("零样本时返回模板本身", () => {
    expect(calibratedCurve(EARLY_BIRD, emptyCalibration())).toBe(EARLY_BIRD);
  });

  it("样本少时只与模板混合，不覆盖（早鸟晚 9 点低能，单次 🔥 只小幅上调）", () => {
    const c = applyFeedback(emptyCalibration(), 21, 3);
    const curve = calibratedCurve(EARLY_BIRD, c);
    const tpl = energyAtHour(EARLY_BIRD, 21.5);
    const calibrated = energyAtHour(curve, 21.5);
    expect(calibrated).toBeGreaterThan(tpl); // 朝反馈方向移动
    // 权重 = min(1,1/3) × min(1,1/10) ≈ 0.033，移动幅度很小
    expect(calibrated - tpl).toBeLessThan(
      0.05 * (RATING_ENERGY[3] - tpl) + 1e-9,
    );
  });

  it("样本充足后该桶接近反馈值，无样本的桶保持模板", () => {
    let c = emptyCalibration();
    for (let i = 0; i < 12; i++) c = applyFeedback(c, 21, 3); // 21 点 12 次 🔥
    const curve = calibratedCurve(EARLY_BIRD, c);
    expect(energyAtHour(curve, 21.5)).toBeGreaterThan(75); // 接近 85
    // 上午 9 点没有任何反馈 → 与模板一致
    expect(energyAtHour(curve, 9.5)).toBeCloseTo(
      energyAtHour(EARLY_BIRD, 9.5),
      5,
    );
  });

  it("夜猫型用户的反馈能把早鸟模板的晚间拉成高能区（≥65 阈值翻转）", () => {
    let c = emptyCalibration();
    for (let h = 20; h <= 22; h++)
      for (let i = 0; i < 5; i++) c = applyFeedback(c, h, 3);
    const curve = calibratedCurve(EARLY_BIRD, c);
    expect(energyAtHour(curve, 21)).toBeGreaterThanOrEqual(65);
  });
});
