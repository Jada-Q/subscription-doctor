/**
 * 时间电网调度器 — 核心数据模型
 *
 * 时间离散化为 15 分钟时隙（slot）。slot 0 = 地平线第 0 天的 00:00，
 * 一天 96 槽，默认地平线 7 天 = 672 槽。睡眠时段的槽不可用（约束 C8）。
 */

/** 认知负载等级：1=轻（邮件/杂务） 2=中 3=深度（需要高精力的创造性工作） */
export type LoadLevel = 1 | 2 | 3;

/** 优先级权重：3=高 2=中 1=低 */
export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  title: string;
  /** 工期，单位槽（15min） */
  duration: number;
  /** 最早可开始槽（缺省 0） */
  release?: number;
  /** 截止槽（end 必须 ≤ deadline；soft 时允许越过但计延误） */
  deadline?: number;
  /** true = 截止不可违反；false/缺省 = 软截止，计入目标函数延误项 */
  hardDeadline?: boolean;
  /** 是否可拆分为多段 */
  splittable: boolean;
  /** 单段最小连续槽数（不可拆任务忽略，整块即一段） */
  minBlock: number;
  load: LoadLevel;
  priority: Priority;
}

/** 会议 = 不可移动基荷，固定区间 [start, end) */
export interface Meeting {
  id: string;
  title: string;
  start: number;
  end: number;
}

/** 精力曲线：一天内的控制点，分段线性插值，每天重复（MVP 不分周几） */
export interface EnergyCurve {
  name: string;
  /** 按 hour 升序的控制点，hour ∈ [0,24)，energy ∈ [0,100] */
  points: { hour: number; energy: number }[];
}

/** 排程结果中的一个任务块，区间 [start, end) */
export interface ScheduleBlock {
  taskId: string;
  start: number;
  end: number;
}

export interface DroppedTask {
  taskId: string;
  reason: string;
}

export interface Schedule {
  blocks: ScheduleBlock[];
  /** 无法安排而被放弃的任务（优雅降级，而非崩溃） */
  dropped: DroppedTask[];
}

/** 一次求解的完整输入 */
export interface Scenario {
  name: string;
  /** 场景说明 + 人类合理排法的对照注释 */
  note?: string;
  tasks: Task[];
  meetings: Meeting[];
  curve: EnergyCurve;
}

export interface GridConfig {
  /** 每小时槽数（15min ⇒ 4） */
  slotsPerHour: number;
  horizonDays: number;
  /** 清醒窗口 [wakeStartHour, wakeEndHour)，窗口外的槽直接不可用（C8） */
  wakeStartHour: number;
  wakeEndHour: number;
  /** 深度任务要求每个占用槽的精力 ≥ 该阈值（C6） */
  deepEnergyThreshold: number;
  /** 任务块与其他任务块/会议之间的最小空闲槽数（C7 的缓冲实现） */
  bufferSlots: number;
  /** 每日最多调度 (清醒空闲槽 × 该系数) 的任务量 —— 内置松弛，对抗计划-现实鸿沟 */
  dailyLoadFactor: number;
}

export const DEFAULT_CONFIG: GridConfig = {
  slotsPerHour: 4,
  horizonDays: 7,
  wakeStartHour: 7,
  wakeEndHour: 23,
  deepEnergyThreshold: 65,
  bufferSlots: 1,
  dailyLoadFactor: 0.7,
};

export function slotsPerDay(cfg: GridConfig): number {
  return 24 * cfg.slotsPerHour;
}

export function horizonSlots(cfg: GridConfig): number {
  return cfg.horizonDays * slotsPerDay(cfg);
}

/** 槽 → 所在天 */
export function dayOfSlot(slot: number, cfg: GridConfig): number {
  return Math.floor(slot / slotsPerDay(cfg));
}

/** 槽是否落在清醒窗口内 */
export function isAwakeSlot(slot: number, cfg: GridConfig): boolean {
  const hour = (slot % slotsPerDay(cfg)) / cfg.slotsPerHour;
  return hour >= cfg.wakeStartHour && hour < cfg.wakeEndHour;
}

/** 便捷构造：第 day 天 hour 点（小数小时）对应的槽 */
export function at(
  day: number,
  hour: number,
  cfg: GridConfig = DEFAULT_CONFIG,
): number {
  return day * slotsPerDay(cfg) + Math.round(hour * cfg.slotsPerHour);
}
