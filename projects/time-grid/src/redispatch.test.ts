import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, at } from "./types.ts";
import { getScenario } from "./scenarios.ts";
import { solve } from "./solver.ts";
import { redispatch } from "./redispatch.ts";
import { validate } from "./validator.ts";

const cfg = DEFAULT_CONFIG;

describe("redispatch — 滚动时域重排", () => {
  it("锁定历史：now 之前的块原样保留，未来块不早于 now", () => {
    const scenario = getScenario("08-week-rolling");
    const original = solve(scenario, cfg);
    const now = at(1, 12);
    const { schedule } = redispatch(scenario, original, now, cfg);

    const pastOriginal = original.blocks
      .filter((b) => b.end <= now)
      .map((b) => `${b.taskId}:${b.start}-${b.end}`)
      .sort();
    const pastNew = schedule.blocks
      .filter((b) => b.end <= now)
      .map((b) => `${b.taskId}:${b.start}-${b.end}`)
      .sort();
    expect(pastNew).toEqual(expect.arrayContaining(pastOriginal));

    for (const b of schedule.blocks.filter((x) => x.end > now)) {
      expect(b.start).toBeGreaterThanOrEqual(now);
    }
  });

  it("未来部分对未来场景可行", () => {
    const scenario = getScenario("08-week-rolling");
    const original = solve(scenario, cfg);
    const now = at(1, 12);
    const { schedule, futureScenario } = redispatch(
      scenario,
      original,
      now,
      cfg,
    );
    const futureOnly = {
      blocks: schedule.blocks.filter((b) => b.start >= now),
      dropped: schedule.dropped,
    };
    const r = validate(futureScenario, futureOnly, cfg);
    expect(r.violations).toEqual([]);
  });

  it("工期守恒：锁定 + 重排的总槽数 = 原工期（无丢弃时）", () => {
    const scenario = getScenario("04-deep-night-owl");
    const original = solve(scenario, cfg);
    const now = at(1, 0);
    const { schedule } = redispatch(scenario, original, now, cfg);
    expect(schedule.dropped).toEqual([]);
    for (const task of scenario.tasks) {
      const total = schedule.blocks
        .filter((b) => b.taskId === task.id)
        .reduce((s, b) => s + (b.end - b.start), 0);
      expect(total).toBe(task.duration);
    }
  });

  it("基荷变化触发重排：新会议挤占原计划时段后仍可行", () => {
    const scenario = getScenario("01-light-day");
    const original = solve(scenario, cfg);
    // 第 0 天 8–12 点突然插入长会，覆盖原上午高能区
    const disrupted = {
      ...scenario,
      meetings: [
        ...scenario.meetings,
        { id: "m-new", title: "临时长会", start: at(0, 8), end: at(0, 12) },
      ],
    };
    const now = at(0, 7);
    const { schedule, futureScenario } = redispatch(
      disrupted,
      original,
      now,
      cfg,
    );
    const futureOnly = {
      blocks: schedule.blocks.filter((b) => b.start >= now),
      dropped: schedule.dropped,
    };
    expect(validate(futureScenario, futureOnly, cfg).violations).toEqual([]);
    // 没有任务块撞进新会议
    for (const b of futureOnly.blocks) {
      const overlap = b.start < at(0, 12) && at(0, 8) < b.end;
      expect(overlap).toBe(false);
    }
  });

  it("稳定性度量为非负数，未被打扰时为 0", () => {
    const scenario = getScenario("04-deep-night-owl");
    const original = solve(scenario, cfg);
    const { stability } = redispatch(scenario, original, 0, cfg);
    expect(stability).toBeGreaterThanOrEqual(0);
  });
});
