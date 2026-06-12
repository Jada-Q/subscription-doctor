import { describe, expect, it } from "vitest";
import type { Scenario, Schedule } from "./types.ts";
import { DEFAULT_CONFIG, at } from "./types.ts";
import { EARLY_BIRD } from "./energy.ts";
import { validate } from "./validator.ts";

const cfg = DEFAULT_CONFIG;

/** 最小场景：1 个深度任务 + 1 个会议 */
const base: Scenario = {
  name: "validator-fixture",
  curve: EARLY_BIRD,
  meetings: [{ id: "m1", title: "会议", start: at(0, 10), end: at(0, 11) }],
  tasks: [
    {
      id: "deep1",
      title: "深度任务",
      duration: 4,
      splittable: false,
      minBlock: 4,
      load: 3,
      priority: 3,
      deadline: at(0, 13),
      hardDeadline: true,
    },
  ],
};

describe("validator", () => {
  it("接受手工构造的可行解", () => {
    // 8:00–9:00 在早鸟高能区（≥65），距 10 点会议有缓冲，截止 13:00 前
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(0, 8), end: at(0, 9) }],
      dropped: [],
    };
    const r = validate(base, schedule, cfg);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("C1 检出与会议重叠", () => {
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(0, 10), end: at(0, 11) }],
      dropped: [],
    };
    const r = validate(base, schedule, cfg);
    expect(r.violations.some((v) => v.includes("C1"))).toBe(true);
  });

  it("C7 检出缓冲不足（紧贴会议结束）", () => {
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(0, 11), end: at(0, 12) }],
      dropped: [],
    };
    const r = validate(base, schedule, cfg);
    expect(r.violations.some((v) => v.includes("C7"))).toBe(true);
  });

  it("C8 检出占用睡眠时段", () => {
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(0, 5), end: at(0, 6) }],
      dropped: [],
    };
    const r = validate(base, schedule, cfg);
    expect(r.violations.some((v) => v.includes("C8"))).toBe(true);
  });

  it("C6 检出深度任务排进低能时隙", () => {
    // 早鸟 21–22 点精力远低于 65
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(0, 21), end: at(0, 22) }],
      dropped: [],
    };
    const r = validate(base, schedule, cfg);
    expect(r.violations.some((v) => v.includes("C6"))).toBe(true);
  });

  it("C3 检出硬截止违反", () => {
    // 早鸟 16 点附近精力 60 < 65 → 用第 1 天 8 点保证只触发截止违规需要换思路：
    // 直接把块排到第 1 天高能区，晚于第 0 天 13:00 硬截止
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(1, 8), end: at(1, 9) }],
      dropped: [],
    };
    const r = validate(base, schedule, cfg);
    expect(r.violations.some((v) => v.includes("C3 硬截止"))).toBe(true);
  });

  it("C4 检出工期不符与非法拆分", () => {
    const short: Schedule = {
      blocks: [{ taskId: "deep1", start: at(0, 8), end: at(0, 8.5) }],
      dropped: [],
    };
    expect(
      validate(base, short, cfg).violations.some((v) => v.includes("C4 工期")),
    ).toBe(true);

    const split: Schedule = {
      blocks: [
        { taskId: "deep1", start: at(0, 8), end: at(0, 8.5) },
        { taskId: "deep1", start: at(0, 9), end: at(0, 9.5) },
      ],
      dropped: [],
    };
    expect(
      validate(base, split, cfg).violations.some((v) => v.includes("不可拆")),
    ).toBe(true);
  });

  it("软截止记延误而非违规", () => {
    const soft: Scenario = {
      ...base,
      tasks: [{ ...base.tasks[0], hardDeadline: false }],
    };
    const schedule: Schedule = {
      blocks: [{ taskId: "deep1", start: at(1, 8), end: at(1, 9) }],
      dropped: [],
    };
    const r = validate(soft, schedule, cfg);
    expect(r.ok).toBe(true);
    expect(r.tardiness.get("deep1")).toBe(at(1, 9) - at(0, 13));
  });

  it("未排程且未声明丢弃 → 违规；声明丢弃 → 通过", () => {
    const empty: Schedule = { blocks: [], dropped: [] };
    expect(validate(base, empty, cfg).ok).toBe(false);

    const dropped: Schedule = {
      blocks: [],
      dropped: [{ taskId: "deep1", reason: "test" }],
    };
    expect(validate(base, dropped, cfg).ok).toBe(true);
  });
});
