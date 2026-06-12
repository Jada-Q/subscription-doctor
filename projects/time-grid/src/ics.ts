import type { GridConfig, Schedule, Task } from "./types.ts";
import { horizonSlots } from "./types.ts";

/**
 * ICS 单向接口（计划文档 §6 MVP）：
 * - 导出：求解结果 → .ics，导入用户自己的 Google/Apple 日历即可在手机上看到计划
 * - 导入：日历导出的 .ics → 会议基荷
 * 时间一律按本地时间处理（浮动时间）；带 TZID 的事件按本地解析（MVP 限制，README 注明）。
 * RRULE 循环事件暂不展开，全天事件跳过——两者都计入 skipped 让用户知情。
 */

const SLOT_MS = (cfg: GridConfig) => (60 / cfg.slotsPerHour) * 60_000;

function midnight(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function slotToDate(slot: number, anchor: Date, cfg: GridConfig): Date {
  return new Date(midnight(anchor).getTime() + slot * SLOT_MS(cfg));
}

export function dateToSlot(date: Date, anchor: Date, cfg: GridConfig): number {
  return Math.round(
    (date.getTime() - midnight(anchor).getTime()) / SLOT_MS(cfg),
  );
}

function fmtLocal(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** 转义 SUMMARY 中的 ICS 特殊字符 */
function escText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function scheduleToICS(
  schedule: Schedule,
  tasks: Task[],
  anchor: Date,
  cfg: GridConfig,
): string {
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  const stamp = fmtLocal(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//time-grid//ZH",
    "CALSCALE:GREGORIAN",
  ];
  for (const b of schedule.blocks) {
    // UID 带任务 ID + 起点：重排后重新导入时同任务块可被日历客户端覆盖
    lines.push(
      "BEGIN:VEVENT",
      `UID:tg-${b.taskId}-${b.start}@time-grid`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtLocal(slotToDate(b.start, anchor, cfg))}`,
      `DTEND:${fmtLocal(slotToDate(b.end, anchor, cfg))}`,
      `SUMMARY:${escText(titleOf.get(b.taskId) ?? b.taskId)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export interface ImportedEvent {
  title: string;
  start: number;
  end: number;
}

export interface ImportResult {
  events: ImportedEvent[];
  /** 全天/循环/地平线外/解析失败的事件数（显式告知，绝不静默丢弃） */
  skipped: number;
}

/** 解析 DTSTART/DTEND 值：本地时间或 UTC（Z 后缀）；返回 null 表示无法处理 */
function parseDt(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z === "Z") {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

export function parseICS(
  text: string,
  anchor: Date,
  cfg: GridConfig,
): ImportResult {
  // 展开折行（RFC 5545：CRLF + 空格/Tab 为续行）
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events: ImportedEvent[] = [];
  let skipped = 0;
  const H = horizonSlots(cfg);

  const chunks = unfolded.split(/BEGIN:VEVENT/).slice(1);
  for (const chunk of chunks) {
    const body = chunk.split(/END:VEVENT/)[0];
    const prop = (name: string): { params: string; value: string } | null => {
      const mm = body.match(
        new RegExp(`^${name}([^:\\r\\n]*):([^\\r\\n]*)`, "m"),
      );
      return mm ? { params: mm[1], value: mm[2] } : null;
    };
    const dtstart = prop("DTSTART");
    const dtend = prop("DTEND");
    const summary = prop("SUMMARY");
    const rrule = prop("RRULE");

    if (!dtstart || !dtend || rrule || dtstart.params.includes("VALUE=DATE")) {
      skipped++; // 缺时间、循环事件、全天事件
      continue;
    }
    const start = parseDt(dtstart.value);
    const end = parseDt(dtend.value);
    if (!start || !end || end <= start) {
      skipped++;
      continue;
    }
    const startSlot = dateToSlot(start, anchor, cfg);
    const endSlot = dateToSlot(end, anchor, cfg);
    if (endSlot <= 0 || startSlot >= H) {
      skipped++; // 在调度地平线之外
      continue;
    }
    events.push({
      title: summary
        ? summary.value.replace(/\\n/g, " ").replace(/\\([\\;,])/g, "$1")
        : "（无标题）",
      start: Math.max(0, startSlot),
      end: Math.min(H, endSlot),
    });
  }
  return { events, skipped };
}
