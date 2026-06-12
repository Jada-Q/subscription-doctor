import type { EnergyCurve } from "./types.ts";
import { energyAtHour } from "./energy.ts";

/**
 * 精力曲线被动标定（计划文档 §5 Level 2）：
 * 用户标记任务完成时做单击微调查（🔥/😐/🥱），按小时桶做 EMA 更新。
 * 抗噪设计：小学习率；单桶样本少时该桶权重低；总样本 < 10 时整体只与模板混合、
 * 不覆盖模板（贝叶斯式先验）。
 */

/** 🥱=1（低能） 😐=2（一般） 🔥=3（高能） */
export type Rating = 1 | 2 | 3;

export const RATING_ENERGY: Record<Rating, number> = { 1: 25, 2: 55, 3: 85 };

export interface Calibration {
  /** 24 小时桶的 EMA 精力值；null = 该桶尚无样本 */
  buckets: (number | null)[];
  /** 每桶样本数 */
  counts: number[];
  /** 总样本数 */
  total: number;
}

/** EMA 学习率 */
const ETA = 0.3;
/** 单桶满权重所需样本数 */
const BUCKET_FULL = 3;
/** 全局满权重所需总样本数（之前只与模板混合） */
const GLOBAL_FULL = 10;

export function emptyCalibration(): Calibration {
  return { buckets: Array(24).fill(null), counts: Array(24).fill(0), total: 0 };
}

/** 录入一次反馈（不可变更新） */
export function applyFeedback(
  c: Calibration,
  hour: number,
  rating: Rating,
): Calibration {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  const buckets = [...c.buckets];
  const counts = [...c.counts];
  const target = RATING_ENERGY[rating];
  const prev = buckets[h];
  buckets[h] = prev === null ? target : (1 - ETA) * prev + ETA * target;
  counts[h] = counts[h] + 1;
  return { buckets, counts, total: c.total + 1 };
}

/** 模板 + 标定数据 → 生效曲线（24 个控制点，复用既有分段线性插值） */
export function calibratedCurve(
  template: EnergyCurve,
  c: Calibration,
): EnergyCurve {
  if (c.total === 0) return template;
  const globalW = Math.min(1, c.total / GLOBAL_FULL);
  const points = Array.from({ length: 24 }, (_, h) => {
    const hour = h + 0.5;
    const tpl = energyAtHour(template, hour);
    const sample = c.buckets[h];
    const w =
      sample === null ? 0 : Math.min(1, c.counts[h] / BUCKET_FULL) * globalW;
    return { hour, energy: (1 - w) * tpl + w * (sample ?? 0) };
  });
  return { name: `${template.name}+calibrated`, points };
}
