import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, at } from "./types.ts";
import { dateToSlot, parseICS, scheduleToICS, slotToDate } from "./ics.ts";

const cfg = DEFAULT_CONFIG;
// 固定锚点：2026-06-12（本地时间），消除测试对运行日期的依赖
const ANCHOR = new Date(2026, 5, 12, 15, 30); // 带时分验证 midnight 归一化

describe("slot ↔ date", () => {
  it("往返一致", () => {
    const slot = at(2, 9.5);
    const d = slotToDate(slot, ANCHOR, cfg);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
    expect(dateToSlot(d, ANCHOR, cfg)).toBe(slot);
  });

  it("slot 0 = 锚点当天 00:00", () => {
    const d = slotToDate(0, ANCHOR, cfg);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    expect(d.getDate()).toBe(12);
  });
});

describe("scheduleToICS", () => {
  it("每个块一个 VEVENT，本地浮动时间，标题转义", () => {
    const ics = scheduleToICS(
      {
        blocks: [
          { taskId: "a", start: at(0, 8), end: at(0, 10) },
          { taskId: "b", start: at(1, 14), end: at(1, 15) },
        ],
        dropped: [],
      },
      [
        {
          id: "a",
          title: "写报告; 初稿",
          duration: 8,
          splittable: true,
          minBlock: 4,
          load: 3,
          priority: 3,
        },
        {
          id: "b",
          title: "杂务",
          duration: 4,
          splittable: true,
          minBlock: 2,
          load: 1,
          priority: 1,
        },
      ],
      ANCHOR,
      cfg,
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART:20260612T080000");
    expect(ics).toContain("DTEND:20260612T100000");
    expect(ics).toContain("DTSTART:20260613T140000");
    expect(ics).toContain("SUMMARY:写报告\\; 初稿");
    expect(ics).toContain("UID:tg-a-");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("parseICS", () => {
  it("解析 Google 风格导出：TZID 参数、折行 SUMMARY、跳过全天与循环事件", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "DTSTART;TZID=Asia/Shanghai:20260612T100000",
      "DTEND;TZID=Asia/Shanghai:20260612T110000",
      "SUMMARY:产品评审",
      " （第二行折行）",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260613",
      "DTEND;VALUE=DATE:20260614",
      "SUMMARY:全天事件应跳过",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20260612T140000",
      "DTEND:20260612T150000",
      "RRULE:FREQ=WEEKLY",
      "SUMMARY:循环事件应跳过",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const r = parseICS(ics, ANCHOR, cfg);
    expect(r.events).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(r.events[0]).toEqual({
      title: "产品评审（第二行折行）",
      start: at(0, 10),
      end: at(0, 11),
    });
  });

  it("UTC（Z 后缀）按本地时区换算", () => {
    const utc = new Date(Date.UTC(2026, 5, 12, 3, 0, 0));
    const expected = dateToSlot(utc, ANCHOR, cfg);
    const ics = [
      "BEGIN:VEVENT",
      "DTSTART:20260612T030000Z",
      "DTEND:20260612T040000Z",
      "SUMMARY:UTC 会议",
      "END:VEVENT",
    ].join("\n");
    const r = parseICS(ics, ANCHOR, cfg);
    // 换算结果可能在地平线外（取决于时区），两种情况都接受但必须自洽
    if (expected >= 0 && expected < at(7, 0)) {
      expect(r.events).toHaveLength(1);
      expect(r.events[0].start).toBe(expected);
    } else {
      expect(r.skipped).toBe(1);
    }
  });

  it("地平线外的事件计入 skipped 而非静默丢弃", () => {
    const ics = [
      "BEGIN:VEVENT",
      "DTSTART:20300101T100000",
      "DTEND:20300101T110000",
      "SUMMARY:远期",
      "END:VEVENT",
    ].join("\n");
    const r = parseICS(ics, ANCHOR, cfg);
    expect(r.events).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it("导出再导入往返：事件落在同一时隙", () => {
    const ics = scheduleToICS(
      {
        blocks: [{ taskId: "a", start: at(3, 9), end: at(3, 11) }],
        dropped: [],
      },
      [
        {
          id: "a",
          title: "深度工作",
          duration: 8,
          splittable: true,
          minBlock: 4,
          load: 3,
          priority: 3,
        },
      ],
      ANCHOR,
      cfg,
    );
    const r = parseICS(ics, ANCHOR, cfg);
    expect(r.events).toEqual([
      { title: "深度工作", start: at(3, 9), end: at(3, 11) },
    ]);
  });
});
