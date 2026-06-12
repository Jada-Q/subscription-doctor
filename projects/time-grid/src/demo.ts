/* eslint-disable no-console -- CLI 演示入口，console 输出即产品 */
import type { Scenario, Schedule } from "./types.ts";
import { DEFAULT_CONFIG, slotsPerDay } from "./types.ts";
import { energyAtSlot } from "./energy.ts";
import { getScenario } from "./scenarios.ts";
import { solve } from "./solver.ts";
import { objectiveB } from "./objective.ts";

/**
 * ASCII 甘特演示：node projects/time-grid/src/demo.ts
 * 每行一天，仅显示清醒窗口 7:00–23:00；上行为精力曲线 sparkline。
 */
const cfg = DEFAULT_CONFIG;
const SPARK = "▁▂▃▄▅▆▇█";

function render(scenario: Scenario, schedule: Schedule): string {
  const spd = slotsPerDay(cfg);
  const wakeStart = cfg.wakeStartHour * cfg.slotsPerHour;
  const wakeEnd = cfg.wakeEndHour * cfg.slotsPerHour;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letterOf = new Map(
    scenario.tasks.map((t, i) => [t.id, letters[i % letters.length]]),
  );

  const lines: string[] = [];
  lines.push(`■ ${scenario.name}（曲线: ${scenario.curve.name}）`);
  if (scenario.note) lines.push(`  ${scenario.note}`);
  lines.push("");
  lines.push(
    `  图例: ${scenario.tasks.map((t) => `${letterOf.get(t.id)}=${t.title}`).join("  ")}  M=会议  ·=空闲`,
  );
  lines.push("");

  // 时刻表头（每 2 小时一个刻度）
  let header = "        ";
  for (let h = cfg.wakeStartHour; h < cfg.wakeEndHour; h += 2) {
    header += String(h).padStart(2, "0").padEnd(8, " ");
  }
  lines.push(header);

  // 精力 sparkline（任意一天，曲线每日重复）
  let spark = "  精力  ";
  for (let s = wakeStart; s < wakeEnd; s++) {
    const e = energyAtSlot(scenario.curve, s, cfg);
    spark += SPARK[Math.min(7, Math.floor((e / 100) * 8))];
  }
  lines.push(spark);

  const usedDays = new Set<number>();
  for (const b of schedule.blocks) usedDays.add(Math.floor(b.start / spd));
  for (const m of scenario.meetings) usedDays.add(Math.floor(m.start / spd));
  const maxDay = Math.max(0, ...usedDays);

  for (let d = 0; d <= maxDay; d++) {
    let row = `  第${d}天 `;
    for (let s = d * spd + wakeStart; s < d * spd + wakeEnd; s++) {
      const meeting = scenario.meetings.find((m) => s >= m.start && s < m.end);
      const block = schedule.blocks.find((b) => s >= b.start && s < b.end);
      row += meeting ? "M" : block ? (letterOf.get(block.taskId) ?? "?") : "·";
    }
    lines.push(row);
  }

  if (schedule.dropped.length > 0) {
    lines.push("");
    for (const dr of schedule.dropped) {
      lines.push(`  ✗ 丢弃 ${dr.taskId}: ${dr.reason}`);
    }
  }
  lines.push("");
  lines.push(
    `  目标 B 得分: ${objectiveB(scenario, schedule, cfg).toFixed(2)}`,
  );
  return lines.join("\n");
}

for (const name of [
  "01-light-day",
  "04-deep-night-owl",
  "07-overload-infeasible",
]) {
  const scenario = getScenario(name);
  const schedule = solve(scenario, cfg);
  console.log(render(scenario, schedule));
  console.log("\n" + "─".repeat(72) + "\n");
}
