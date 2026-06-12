import type { GridConfig, Scenario, Schedule } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { greedySolve } from "./greedy.ts";
import {
  improve,
  DEFAULT_LS_OPTIONS,
  type LocalSearchOptions,
} from "./localSearch.ts";

/**
 * 求解入口：贪心构造（第 0 层，即时可行解）→ 局部搜索打磨（爬山）。
 * Phase 2 将在此处插入 highs-js MILP 精解层（以贪心解 warm start）。
 */
export function solve(
  scenario: Scenario,
  cfg: GridConfig = DEFAULT_CONFIG,
  lsOptions: LocalSearchOptions = DEFAULT_LS_OPTIONS,
): Schedule {
  const initial = greedySolve(scenario, cfg);
  return improve(scenario, initial, cfg, lsOptions);
}
