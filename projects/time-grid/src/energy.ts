import type { EnergyCurve, GridConfig } from "./types.ts";
import { slotsPerDay } from "./types.ts";

/** 早鸟：峰值 9–12 点，午后下沉，晚间走低 */
export const EARLY_BIRD: EnergyCurve = {
  name: "early-bird",
  points: [
    { hour: 0, energy: 15 },
    { hour: 6, energy: 30 },
    { hour: 8, energy: 70 },
    { hour: 9, energy: 85 },
    { hour: 12, energy: 80 },
    { hour: 14, energy: 50 },
    { hour: 16, energy: 60 },
    { hour: 19, energy: 45 },
    { hour: 23, energy: 20 },
  ],
};

/** 夜猫：上午低迷，20–24 点为高能区 */
export const NIGHT_OWL: EnergyCurve = {
  name: "night-owl",
  points: [
    { hour: 0, energy: 70 },
    { hour: 2, energy: 40 },
    { hour: 8, energy: 25 },
    { hour: 11, energy: 45 },
    { hour: 14, energy: 55 },
    { hour: 17, energy: 60 },
    { hour: 20, energy: 80 },
    { hour: 22, energy: 85 },
    { hour: 24, energy: 70 },
  ],
};

/** 双峰：10 点与 16 点两个高能峰，午后谷在 13–14 点 */
export const TWIN_PEAKS: EnergyCurve = {
  name: "twin-peaks",
  points: [
    { hour: 0, energy: 15 },
    { hour: 7, energy: 40 },
    { hour: 10, energy: 80 },
    { hour: 12, energy: 65 },
    { hour: 13.5, energy: 45 },
    { hour: 16, energy: 78 },
    { hour: 19, energy: 55 },
    { hour: 23, energy: 25 },
  ],
};

export const TEMPLATES: EnergyCurve[] = [EARLY_BIRD, NIGHT_OWL, TWIN_PEAKS];

/** 一天内某时刻（小数小时）的精力，控制点间分段线性插值，首尾按端点值延伸 */
export function energyAtHour(curve: EnergyCurve, hour: number): number {
  const pts = curve.points;
  if (hour <= pts[0].hour) return pts[0].energy;
  for (let i = 1; i < pts.length; i++) {
    if (hour <= pts[i].hour) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (hour - a.hour) / (b.hour - a.hour);
      return a.energy + t * (b.energy - a.energy);
    }
  }
  return pts[pts.length - 1].energy;
}

/** 某槽的精力（取槽中点时刻，每天重复同一条曲线） */
export function energyAtSlot(
  curve: EnergyCurve,
  slot: number,
  cfg: GridConfig,
): number {
  const hour = ((slot % slotsPerDay(cfg)) + 0.5) / cfg.slotsPerHour;
  return energyAtHour(curve, hour);
}

/** 区间 [start, end) 的平均精力 */
export function avgEnergy(
  curve: EnergyCurve,
  start: number,
  end: number,
  cfg: GridConfig,
): number {
  let sum = 0;
  for (let t = start; t < end; t++) sum += energyAtSlot(curve, t, cfg);
  return sum / Math.max(1, end - start);
}
