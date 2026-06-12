import type {
  GridConfig,
  Scenario,
  Schedule,
  ScheduleBlock,
  Task,
} from "./types.ts";
import { horizonSlots, isAwakeSlot, dayOfSlot, slotsPerDay } from "./types.ts";
import { avgEnergy, energyAtSlot } from "./energy.ts";
import { dailyFreeAwakeSlots, fitsWithBuffer } from "./validator.ts";

/**
 * 贪心构造启发式（第 0 层求解器，<10ms 出可行解）：
 * 1. 深度任务优先抢占高能时隙（按 load 降序 → 优先级降序 → 紧迫度降序）
 * 2. 轻任务主动让出高能区（在可行位置里选平均精力最低的）
 * 3. 可拆任务填缝，段长尽量大（配合目标 B 的超线性块长奖励）
 * 4. 超载时优雅降级：放弃无法安排的任务并记录原因
 */

interface PlacementState {
  occupied: { start: number; end: number }[];
  /** day → 剩余任务槽预算（dailyLoadFactor 松弛后） */
  budget: Map<number, number>;
}

function urgency(task: Task, cfg: GridConfig): number {
  if (task.deadline === undefined) return 0;
  const span = Math.max(1, task.deadline - (task.release ?? 0));
  return task.priority / span;
}

function orderTasks(tasks: Task[], cfg: GridConfig): Task[] {
  return [...tasks].sort(
    (a, b) =>
      b.load - a.load ||
      b.priority - a.priority ||
      urgency(b, cfg) - urgency(a, cfg) ||
      a.id.localeCompare(b.id),
  );
}

function budgetAllows(
  state: PlacementState,
  start: number,
  end: number,
  cfg: GridConfig,
): boolean {
  const need = new Map<number, number>();
  for (let t = start; t < end; t++) {
    const d = dayOfSlot(t, cfg);
    need.set(d, (need.get(d) ?? 0) + 1);
  }
  for (const [d, n] of need) {
    if ((state.budget.get(d) ?? 0) < n) return false;
  }
  return true;
}

function consumeBudget(
  state: PlacementState,
  start: number,
  end: number,
  cfg: GridConfig,
): void {
  for (let t = start; t < end; t++) {
    const d = dayOfSlot(t, cfg);
    state.budget.set(d, (state.budget.get(d) ?? 0) - 1);
  }
}

/** 区间 [start, start+len) 是否对该任务可行（不含目标偏好，只看硬条件） */
function canPlace(
  scenario: Scenario,
  task: Task,
  start: number,
  len: number,
  state: PlacementState,
  cfg: GridConfig,
  enforceDeadline: boolean,
): boolean {
  const end = start + len;
  if (start < (task.release ?? 0)) return false;
  if (end > horizonSlots(cfg)) return false;
  if (enforceDeadline && task.deadline !== undefined && end > task.deadline)
    return false;
  for (let t = start; t < end; t++) {
    if (!isAwakeSlot(t, cfg)) return false;
    if (
      task.load === 3 &&
      energyAtSlot(scenario.curve, t, cfg) < cfg.deepEnergyThreshold
    ) {
      return false;
    }
  }
  if (!fitsWithBuffer({ start, end }, state.occupied, cfg.bufferSlots))
    return false;
  if (!budgetAllows(state, start, end, cfg)) return false;
  return true;
}

/** 在所有可行起点中按任务负载等级的策略挑最优起点；无可行位置返回 null */
function bestStart(
  scenario: Scenario,
  task: Task,
  len: number,
  state: PlacementState,
  cfg: GridConfig,
  enforceDeadline: boolean,
): number | null {
  let best: number | null = null;
  let bestScore = -Infinity;
  const H = horizonSlots(cfg);
  for (let s = task.release ?? 0; s + len <= H; s++) {
    if (!canPlace(scenario, task, s, len, state, cfg, enforceDeadline))
      continue;
    const e = avgEnergy(scenario.curve, s, s + len, cfg);
    // 深度：精力最大化；轻：精力最小化（让出高能区）；中：最早开始。
    // 同分取更早的起点（-s/1e6 作微小决胜项），保证确定性。
    // 软截止被放宽时，延误按目标 B 的权重计入评分，避免"为了一点精力增益拖一整天"。
    const lateness =
      task.deadline !== undefined
        ? Math.max(0, s + len - task.deadline) * 2 * task.priority
        : 0;
    const base =
      task.load === 3 ? e - s / 1e6 : task.load === 1 ? -e - s / 1e6 : -s;
    const score = base - lateness;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

function placeBlock(
  state: PlacementState,
  block: ScheduleBlock,
  cfg: GridConfig,
): void {
  state.occupied.push({ start: block.start, end: block.end });
  consumeBudget(state, block.start, block.end, cfg);
}

/** 安排单个任务；成功返回块列表，失败返回 null（不修改 state） */
function placeTask(
  scenario: Scenario,
  task: Task,
  state: PlacementState,
  cfg: GridConfig,
  enforceDeadline: boolean,
): ScheduleBlock[] | null {
  // 试探性放置：先在 state 的副本上操作，全部成功才提交
  const trial: PlacementState = {
    occupied: [...state.occupied],
    budget: new Map(state.budget),
  };
  const blocks: ScheduleBlock[] = [];

  if (!task.splittable) {
    const s = bestStart(
      scenario,
      task,
      task.duration,
      trial,
      cfg,
      enforceDeadline,
    );
    if (s === null) return null;
    blocks.push({ taskId: task.id, start: s, end: s + task.duration });
    placeBlock(trial, blocks[0], cfg);
  } else {
    let remaining = task.duration;
    while (remaining > 0) {
      let placed = false;
      // 段长从大到小试（长块在目标 B 下更值钱），但保证余量为 0 或 ≥ minBlock
      for (let len = remaining; len >= task.minBlock; len--) {
        const rest = remaining - len;
        if (rest > 0 && rest < task.minBlock) continue;
        const s = bestStart(scenario, task, len, trial, cfg, enforceDeadline);
        if (s === null) continue;
        const block = { taskId: task.id, start: s, end: s + len };
        blocks.push(block);
        placeBlock(trial, block, cfg);
        remaining -= len;
        placed = true;
        break;
      }
      if (!placed) return null;
    }
  }

  // 提交
  state.occupied = trial.occupied;
  state.budget = trial.budget;
  return blocks;
}

export function greedySolve(scenario: Scenario, cfg: GridConfig): Schedule {
  const state: PlacementState = {
    occupied: scenario.meetings.map((m) => ({ start: m.start, end: m.end })),
    budget: new Map(),
  };
  for (let d = 0; d < cfg.horizonDays; d++) {
    state.budget.set(
      d,
      Math.floor(dailyFreeAwakeSlots(scenario, d, cfg) * cfg.dailyLoadFactor),
    );
  }

  const schedule: Schedule = { blocks: [], dropped: [] };

  for (const task of orderTasks(scenario.tasks, cfg)) {
    // 先尊重截止时间；软截止放不下时允许越过截止（计延误，好过丢弃）
    let blocks = placeTask(scenario, task, state, cfg, true);
    if (blocks === null && task.deadline !== undefined && !task.hardDeadline) {
      blocks = placeTask(scenario, task, state, cfg, false);
    }
    if (blocks === null) {
      schedule.dropped.push({
        taskId: task.id,
        reason: task.hardDeadline
          ? "硬截止前无可行时段"
          : "地平线内无可行时段（容量不足）",
      });
    } else {
      schedule.blocks.push(...blocks);
    }
  }

  schedule.blocks.sort((a, b) => a.start - b.start);
  return schedule;
}
