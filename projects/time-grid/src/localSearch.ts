import type { GridConfig, Scenario, Schedule, ScheduleBlock } from "./types.ts";
import { objectiveB } from "./objective.ts";

/**
 * 局部搜索（爬山）：在贪心解上做三种邻域动作，只接受目标 B 改进的候选。
 * 候选可行性由 objectiveB 内部的 validate 保证（不可行 → -Infinity，必被拒绝）。
 * 随机数种子化，结果可复现。
 */
export interface LocalSearchOptions {
  iterations: number;
  seed: number;
}

export const DEFAULT_LS_OPTIONS: LocalSearchOptions = {
  iterations: 400,
  seed: 42,
};

/** 线性同余生成器：确定性伪随机 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function cloneSchedule(s: Schedule): Schedule {
  return {
    blocks: s.blocks.map((b) => ({ ...b })),
    dropped: s.dropped.map((d) => ({ ...d })),
  };
}

/** 动作 1：随机平移一个块 ±1..16 槽 */
function moveShift(s: Schedule, rng: () => number): Schedule | null {
  if (s.blocks.length === 0) return null;
  const c = cloneSchedule(s);
  const i = Math.floor(rng() * c.blocks.length);
  const delta = (Math.floor(rng() * 16) + 1) * (rng() < 0.5 ? -1 : 1);
  c.blocks[i] = {
    ...c.blocks[i],
    start: c.blocks[i].start + delta,
    end: c.blocks[i].end + delta,
  };
  return c;
}

/** 动作 2：交换两个等长块的位置 */
function moveSwap(s: Schedule, rng: () => number): Schedule | null {
  if (s.blocks.length < 2) return null;
  const c = cloneSchedule(s);
  const i = Math.floor(rng() * c.blocks.length);
  const j = Math.floor(rng() * c.blocks.length);
  const a = c.blocks[i];
  const b = c.blocks[j];
  if (i === j || a.taskId === b.taskId) return null;
  if (a.end - a.start !== b.end - b.start) return null;
  c.blocks[i] = { ...a, start: b.start, end: b.end };
  c.blocks[j] = { ...b, start: a.start, end: a.end };
  return c;
}

/** 动作 3：合并同一任务的两个相邻段（减碎片，吃超线性块长奖励） */
function moveMerge(s: Schedule, rng: () => number): Schedule | null {
  const byTask = new Map<string, ScheduleBlock[]>();
  for (const b of s.blocks) {
    const list = byTask.get(b.taskId) ?? [];
    list.push(b);
    byTask.set(b.taskId, list);
  }
  const fragmented = [...byTask.entries()].filter(([, bs]) => bs.length >= 2);
  if (fragmented.length === 0) return null;
  const [taskId, bs] = fragmented[Math.floor(rng() * fragmented.length)];
  const sorted = [...bs].sort((x, y) => x.start - y.start);
  const [first, second] = [sorted[0], sorted[1]];
  const len = first.end - first.start + (second.end - second.start);
  // 候选位置：并到第一段起点，或倒推到第二段终点
  const start = rng() < 0.5 ? first.start : second.end - len;
  const c = cloneSchedule(s);
  c.blocks = c.blocks.filter((b) => b !== undefined);
  const rest = c.blocks.filter(
    (b) =>
      b.taskId !== taskId ||
      !(
        (b.start === first.start && b.end === first.end) ||
        (b.start === second.start && b.end === second.end)
      ),
  );
  rest.push({ taskId, start, end: start + len });
  c.blocks = rest;
  return c;
}

export function improve(
  scenario: Scenario,
  schedule: Schedule,
  cfg: GridConfig,
  options: LocalSearchOptions = DEFAULT_LS_OPTIONS,
): Schedule {
  const rng = makeRng(options.seed);
  let current = cloneSchedule(schedule);
  let currentScore = objectiveB(scenario, current, cfg);
  if (currentScore === -Infinity) return schedule; // 起点不可行则原样返回

  const moves = [moveShift, moveSwap, moveMerge];
  for (let it = 0; it < options.iterations; it++) {
    const move = moves[Math.floor(rng() * moves.length)];
    const candidate = move(current, rng);
    if (!candidate) continue;
    const score = objectiveB(scenario, candidate, cfg);
    if (score > currentScore) {
      current = candidate;
      currentScore = score;
    }
  }
  current.blocks.sort((a, b) => a.start - b.start);
  return current;
}
