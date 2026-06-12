import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, at, slotsPerDay } from "./types.ts";
import { SCENARIOS, getScenario } from "./scenarios.ts";
import { greedySolve } from "./greedy.ts";
import { improve } from "./localSearch.ts";
import { solve } from "./solver.ts";
import { validate } from "./validator.ts";
import { objectiveB } from "./objective.ts";

const cfg = DEFAULT_CONFIG;

describe("greedy solver — 全场景可行性（Phase 1 验证标准）", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: 零硬约束违反`, () => {
      const schedule = greedySolve(scenario, cfg);
      const r = validate(scenario, schedule, cfg);
      expect(r.violations).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }
});

describe("局部搜索", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: 目标值不劣于贪心解，且仍可行`, () => {
      const greedy = greedySolve(scenario, cfg);
      const improved = improve(scenario, greedy, cfg);
      expect(validate(scenario, improved, cfg).ok).toBe(true);
      expect(objectiveB(scenario, improved, cfg)).toBeGreaterThanOrEqual(
        objectiveB(scenario, greedy, cfg),
      );
    });
  }
});

describe("场景特定行为", () => {
  it("03-deadline-clash: 双硬截止任务都在 13:00 前完成，无丢弃", () => {
    const scenario = getScenario("03-deadline-clash");
    const s = solve(scenario, cfg);
    expect(s.dropped).toEqual([]);
    for (const b of s.blocks) {
      expect(b.end).toBeLessThanOrEqual(at(0, 13));
    }
  });

  it("04-deep-night-owl: 深度任务全部排在傍晚高能区（≥17 点）", () => {
    const scenario = getScenario("04-deep-night-owl");
    const s = solve(scenario, cfg);
    const deepIds = new Set(["paper", "code"]);
    const spd = slotsPerDay(cfg);
    for (const b of s.blocks.filter((x) => deepIds.has(x.taskId))) {
      const hour = (b.start % spd) / cfg.slotsPerHour;
      expect(hour).toBeGreaterThanOrEqual(17);
    }
  });

  it("05-unsplittable-long: 3 小时任务保持单块，且因第 0 天放不下而排到次日", () => {
    const scenario = getScenario("05-unsplittable-long");
    const s = solve(scenario, cfg);
    const blocks = s.blocks.filter((b) => b.taskId === "recording");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].end - blocks[0].start).toBe(12);
    expect(blocks[0].start).toBeGreaterThanOrEqual(at(1, 0));
  });

  it("07-overload-infeasible: 优雅降级，丢弃的恰是低优先级任务", () => {
    const scenario = getScenario("07-overload-infeasible");
    const s = solve(scenario, cfg);
    expect(s.dropped.length).toBeGreaterThan(0);
    // 高优先级（job1/job2）必须存活
    const droppedIds = s.dropped.map((d) => d.taskId);
    expect(droppedIds).not.toContain("job1");
    expect(droppedIds).not.toContain("job2");
    for (const d of s.dropped) {
      expect(d.reason.length).toBeGreaterThan(0);
    }
  });

  it("01-light-day: 深度报告排进早鸟上午高能区", () => {
    const scenario = getScenario("01-light-day");
    const s = solve(scenario, cfg);
    expect(s.dropped).toEqual([]);
    const spd = slotsPerDay(cfg);
    for (const b of s.blocks.filter((x) => x.taskId === "report")) {
      const hour = (b.start % spd) / cfg.slotsPerHour;
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThan(13.5);
    }
  });

  it("08-week-rolling: 7 天 30+ 槽任务全部排下，无丢弃", () => {
    const scenario = getScenario("08-week-rolling");
    const s = solve(scenario, cfg);
    expect(s.dropped).toEqual([]);
  });

  it("确定性：同输入同种子 → 同输出", () => {
    const scenario = getScenario("08-week-rolling");
    const a = solve(scenario, cfg);
    const b = solve(scenario, cfg);
    expect(a).toEqual(b);
  });

  it("性能：8 场景贪心求解总耗时 < 2s", () => {
    const t0 = performance.now();
    for (const scenario of SCENARIOS) greedySolve(scenario, cfg);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
