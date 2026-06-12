import type {
  GridConfig,
  Scenario,
  Schedule,
  ScheduleBlock,
  Task,
} from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { solve } from "./solver.ts";
import { DEFAULT_LS_OPTIONS, type LocalSearchOptions } from "./localSearch.ts";

/**
 * 滚动时域重排（re-dispatch）：
 * - now 之前的时隙是历史，已执行的块（或块的已执行部分）锁定不动；
 * - 只对剩余工期重新求解，已执行部分转为固定基荷（伪会议）；
 * - 输出计划稳定性度量：与上版计划相比任务起点的总移动量（槽数），
 *   供"重排不应面目全非"的信任度监控使用。
 */
export interface RedispatchResult {
  /** 锁定的历史块 + 重排后的未来块 */
  schedule: Schedule;
  /** 仅未来部分对应的场景（含伪会议），可直接交给 validate */
  futureScenario: Scenario;
  /** Σ |新起点 − 旧起点|，对两版计划都存在的任务统计（首块起点） */
  stability: number;
}

export function redispatch(
  scenario: Scenario,
  previous: Schedule,
  now: number,
  cfg: GridConfig = DEFAULT_CONFIG,
  lsOptions: LocalSearchOptions = DEFAULT_LS_OPTIONS,
): RedispatchResult {
  const lockedBlocks: ScheduleBlock[] = [];
  const completed = new Map<string, number>();

  for (const b of previous.blocks) {
    if (b.end <= now) {
      lockedBlocks.push({ ...b });
      completed.set(
        b.taskId,
        (completed.get(b.taskId) ?? 0) + (b.end - b.start),
      );
    } else if (b.start < now) {
      // 跨越 now 的块：已执行部分锁定，剩余并入待排工期
      lockedBlocks.push({ taskId: b.taskId, start: b.start, end: now });
      completed.set(b.taskId, (completed.get(b.taskId) ?? 0) + (now - b.start));
    }
  }

  // 构造未来场景：剩余工期 > 0 的任务 + 原会议（含未来的）+ 锁定块转为伪会议
  const futureTasks: Task[] = [];
  for (const t of scenario.tasks) {
    const remaining = t.duration - (completed.get(t.id) ?? 0);
    if (remaining <= 0) continue;
    futureTasks.push({
      ...t,
      duration: remaining,
      release: Math.max(t.release ?? 0, now),
      minBlock: Math.min(t.minBlock, remaining),
    });
  }
  const futureScenario: Scenario = {
    ...scenario,
    name: `${scenario.name}@redispatch:${now}`,
    tasks: futureTasks,
    meetings: [
      ...scenario.meetings,
      ...lockedBlocks.map((b, i) => ({
        id: `locked-${b.taskId}-${i}`,
        title: `已执行: ${b.taskId}`,
        start: b.start,
        end: b.end,
      })),
    ],
  };

  const futureSchedule = solve(futureScenario, cfg, lsOptions);

  // 稳定性：对两版计划都有未来块的任务，比较首块起点
  const firstStart = (
    blocks: ScheduleBlock[],
    taskId: string,
  ): number | undefined => {
    const own = blocks
      .filter((b) => b.taskId === taskId)
      .sort((a, b) => a.start - b.start);
    return own[0]?.start;
  };
  let stability = 0;
  for (const t of futureTasks) {
    const oldStart = firstStart(
      previous.blocks.filter((b) => b.end > now),
      t.id,
    );
    const newStart = firstStart(futureSchedule.blocks, t.id);
    if (oldStart !== undefined && newStart !== undefined) {
      stability += Math.abs(newStart - oldStart);
    }
  }

  return {
    schedule: {
      blocks: [...lockedBlocks, ...futureSchedule.blocks].sort(
        (a, b) => a.start - b.start,
      ),
      dropped: futureSchedule.dropped,
    },
    futureScenario,
    stability,
  };
}
