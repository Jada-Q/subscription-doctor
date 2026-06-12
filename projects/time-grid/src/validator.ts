import type { GridConfig, Scenario, Schedule, ScheduleBlock } from "./types.ts";
import { horizonSlots, isAwakeSlot, slotsPerDay, dayOfSlot } from "./types.ts";
import { energyAtSlot } from "./energy.ts";

/**
 * 可行性校验器 —— 所有求解器（贪心/局部搜索/未来的 MILP）的统一裁判。
 * 检查计划文档 §3.3 的约束 C1–C8（C7 以"任务块间最小缓冲"形式实现）。
 */
export interface ValidationResult {
  ok: boolean;
  violations: string[];
  /** taskId → 软截止延误槽数（不算违规，进目标函数） */
  tardiness: Map<string, number>;
}

/** 一天内的清醒空闲槽数（扣除会议），用于每日负载率预算 */
export function dailyFreeAwakeSlots(
  scenario: Scenario,
  day: number,
  cfg: GridConfig,
): number {
  const spd = slotsPerDay(cfg);
  let free = 0;
  for (let t = day * spd; t < (day + 1) * spd; t++) {
    if (!isAwakeSlot(t, cfg)) continue;
    const inMeeting = scenario.meetings.some((m) => t >= m.start && t < m.end);
    if (!inMeeting) free++;
  }
  return free;
}

export function validate(
  scenario: Scenario,
  schedule: Schedule,
  cfg: GridConfig,
): ValidationResult {
  const violations: string[] = [];
  const tardiness = new Map<string, number>();
  const H = horizonSlots(cfg);
  const droppedIds = new Set(schedule.dropped.map((d) => d.taskId));
  const taskById = new Map(scenario.tasks.map((t) => [t.id, t]));

  // --- 块级基本检查：边界、清醒窗口（C8）、任务存在 ---
  for (const b of schedule.blocks) {
    if (b.start < 0 || b.end > H || b.start >= b.end) {
      violations.push(`块越界或为空: ${b.taskId} [${b.start},${b.end})`);
      continue;
    }
    if (!taskById.has(b.taskId)) {
      violations.push(`未知任务: ${b.taskId}`);
      continue;
    }
    for (let t = b.start; t < b.end; t++) {
      if (!isAwakeSlot(t, cfg)) {
        violations.push(`C8 睡眠时段被占用: ${b.taskId} @ slot ${t}`);
        break;
      }
    }
  }

  // --- C1/C2 互斥：任务块之间、任务块与会议之间不得重叠 ---
  const sorted: {
    start: number;
    end: number;
    id: string;
    isMeeting: boolean;
  }[] = [
    ...schedule.blocks.map((b) => ({
      start: b.start,
      end: b.end,
      id: b.taskId,
      isMeeting: false,
    })),
    ...scenario.meetings.map((m) => ({
      start: m.start,
      end: m.end,
      id: m.id,
      isMeeting: true,
    })),
  ].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.start < prev.end) {
      if (prev.isMeeting && cur.isMeeting) continue; // 基荷自身重叠不归排程管
      violations.push(`C1 重叠: ${prev.id} 与 ${cur.id}`);
    } else if (
      cur.start - prev.end < cfg.bufferSlots &&
      !(prev.isMeeting && cur.isMeeting)
    ) {
      // C7 缓冲：任意任务块与相邻活动之间须有 ≥ bufferSlots 的空闲
      violations.push(
        `C7 缓冲不足: ${prev.id} → ${cur.id} (间隔 ${cur.start - prev.end} 槽)`,
      );
    }
  }

  // --- 任务级检查 ---
  for (const task of scenario.tasks) {
    const blocks = schedule.blocks
      .filter((b) => b.taskId === task.id)
      .sort((a, b) => a.start - b.start);

    if (droppedIds.has(task.id)) {
      if (blocks.length > 0) violations.push(`已丢弃任务仍有排块: ${task.id}`);
      continue;
    }
    if (blocks.length === 0) {
      violations.push(`任务未排程且未声明丢弃: ${task.id}`);
      continue;
    }

    // C4 工期守恒 + 最小块长 + 不可拆单块
    const total = blocks.reduce((s, b) => s + (b.end - b.start), 0);
    if (total !== task.duration) {
      violations.push(
        `C4 工期不符: ${task.id} 排了 ${total}/${task.duration} 槽`,
      );
    }
    if (!task.splittable && blocks.length > 1) {
      violations.push(`C4 不可拆任务被拆分: ${task.id} (${blocks.length} 段)`);
    }
    if (task.splittable) {
      for (const b of blocks) {
        if (b.end - b.start < task.minBlock) {
          violations.push(
            `C4 段长 < minBlock: ${task.id} [${b.start},${b.end})`,
          );
        }
      }
    }

    // C3 时间窗
    const release = task.release ?? 0;
    if (blocks[0].start < release) {
      violations.push(
        `C3 早于释放时间: ${task.id} start=${blocks[0].start} < ${release}`,
      );
    }
    const finish = blocks[blocks.length - 1].end;
    if (task.deadline !== undefined && finish > task.deadline) {
      if (task.hardDeadline) {
        violations.push(
          `C3 硬截止违反: ${task.id} end=${finish} > ${task.deadline}`,
        );
      } else {
        tardiness.set(task.id, finish - task.deadline);
      }
    }

    // C6 深度任务只能排在高能时隙
    if (task.load === 3) {
      for (const b of blocks) {
        for (let t = b.start; t < b.end; t++) {
          if (energyAtSlot(scenario.curve, t, cfg) < cfg.deepEnergyThreshold) {
            violations.push(`C6 深度任务排进低能时隙: ${task.id} @ slot ${t}`);
            break;
          }
        }
      }
    }
  }

  // --- 每日负载率（内置松弛）：当天任务槽数 ≤ floor(空闲清醒槽 × dailyLoadFactor) ---
  const perDay = new Map<number, number>();
  for (const b of schedule.blocks) {
    for (let t = b.start; t < b.end; t++) {
      const d = dayOfSlot(t, cfg);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
  }
  for (const [day, used] of perDay) {
    const budget = Math.floor(
      dailyFreeAwakeSlots(scenario, day, cfg) * cfg.dailyLoadFactor,
    );
    if (used > budget) {
      violations.push(
        `负载率超限: 第 ${day} 天排了 ${used} 槽 > 预算 ${budget}`,
      );
    }
  }

  return { ok: violations.length === 0, violations, tardiness };
}

/** 给定块集合，判断与现有活动（块+会议）是否冲突（含缓冲），供求解器在构造时复用 */
export function fitsWithBuffer(
  candidate: { start: number; end: number },
  existing: { start: number; end: number }[],
  bufferSlots: number,
): boolean {
  for (const e of existing) {
    if (
      candidate.start < e.end + bufferSlots &&
      e.start < candidate.end + bufferSlots
    )
      return false;
  }
  return true;
}

export type { ScheduleBlock };
