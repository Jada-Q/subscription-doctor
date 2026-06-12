import type { GridConfig, Scenario, Schedule } from "./types.ts";
import { avgEnergy } from "./energy.ts";
import { validate } from "./validator.ts";

/**
 * 目标函数 B（计划文档 §3.4，默认目标）：
 *   max  Σ 深度块 [ 块长 × 超线性系数 × 精力匹配 ]
 *      − β Σ w_j · tard_j − γ · 碎片数 − δ Σ 丢弃任务权重
 *
 * 直觉：奖励"长块 × 高能时段"，惩罚切碎、拖延和丢弃。
 * 返回值越大越好。不可行解返回 -Infinity（调用方应先 validate）。
 */
export const WEIGHTS = {
  /** 软截止延误：每槽 × 优先级 */
  beta: 2,
  /** 每多一个碎片段的惩罚 */
  gamma: 1,
  /** 丢弃任务：每级优先级的惩罚 */
  dropPenalty: 50,
};

/** 块长超线性系数：90 分钟块的价值 > 3 个 30 分钟块之和（分段线性近似） */
export function blockLengthFactor(lenSlots: number): number {
  if (lenSlots >= 6) return 1.3; // ≥90min
  if (lenSlots >= 4) return 1.15; // ≥60min
  return 1.0;
}

export function objectiveB(
  scenario: Scenario,
  schedule: Schedule,
  cfg: GridConfig,
): number {
  const result = validate(scenario, schedule, cfg);
  if (!result.ok) return -Infinity;

  const taskById = new Map(scenario.tasks.map((t) => [t.id, t]));
  let score = 0;

  // 深度块奖励
  for (const b of schedule.blocks) {
    const task = taskById.get(b.taskId);
    if (!task || task.load !== 3) continue;
    const len = b.end - b.start;
    const match = avgEnergy(scenario.curve, b.start, b.end, cfg) / 100;
    score += len * blockLengthFactor(len) * match;
  }

  // 软截止延误
  for (const [taskId, tard] of result.tardiness) {
    const task = taskById.get(taskId);
    score -= WEIGHTS.beta * (task?.priority ?? 1) * tard;
  }

  // 碎片惩罚：每个任务超出 1 段的部分
  const segCount = new Map<string, number>();
  for (const b of schedule.blocks) {
    segCount.set(b.taskId, (segCount.get(b.taskId) ?? 0) + 1);
  }
  for (const n of segCount.values()) {
    score -= WEIGHTS.gamma * (n - 1);
  }

  // 丢弃惩罚
  for (const d of schedule.dropped) {
    const task = taskById.get(d.taskId);
    score -= WEIGHTS.dropPenalty * (task?.priority ?? 1);
  }

  return score;
}
