import "./style.css";
import type { Meeting, Scenario, Schedule, Task } from "../types.ts";
import { DEFAULT_CONFIG, at, slotsPerDay } from "../types.ts";
import { TEMPLATES, energyAtSlot } from "../energy.ts";
import { solve } from "../solver.ts";
import { objectiveB } from "../objective.ts";
import { parseICS, scheduleToICS, slotToDate } from "../ics.ts";

/**
 * 时间电网 Time Grid — Phase 2 最小 UI。
 * 全部端侧：状态存 localStorage，求解在本线程（贪心+局部搜索，毫秒级；
 * highs-js MILP 精解层接入时再移到 Web Worker）。
 */

const cfg = DEFAULT_CONFIG;
const STORAGE_KEY = "time-grid-state-v1";
/** 调度锚点：第 0 天 = 今天（本地时间） */
const ANCHOR = new Date();

function dayLabel(d: number): string {
  const date = slotToDate(d * slotsPerDay(cfg), ANCHOR, cfg);
  const md = `${date.getMonth() + 1}/${date.getDate()}`;
  return d === 0 ? `今天 ${md}` : md;
}

interface AppState {
  tasks: Task[];
  meetings: Meeting[];
  curveName: string;
}

interface UiState {
  schedule: Schedule | null;
  error: string | null;
}

const PALETTE = [
  "#2563eb",
  "#db2777",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // 损坏的存档直接忽略，回到空状态
  }
  return { tasks: [], meetings: [], curveName: TEMPLATES[0].name };
}

function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用（隐私模式等）不阻塞核心功能
  }
}

function curveOf(state: AppState) {
  return TEMPLATES.find((c) => c.name === state.curveName) ?? TEMPLATES[0];
}

function toScenario(state: AppState): Scenario {
  return {
    name: "user",
    tasks: state.tasks,
    meetings: state.meetings,
    curve: curveOf(state),
  };
}

const SAMPLE: Pick<AppState, "tasks" | "meetings"> = {
  tasks: [
    {
      id: "t-report",
      title: "写季度报告",
      duration: 8,
      splittable: true,
      minBlock: 4,
      load: 3,
      priority: 3,
      deadline: at(1, 0),
    },
    {
      id: "t-review",
      title: "代码评审",
      duration: 4,
      splittable: true,
      minBlock: 2,
      load: 2,
      priority: 2,
      deadline: at(2, 0),
    },
    {
      id: "t-email",
      title: "清邮箱",
      duration: 2,
      splittable: true,
      minBlock: 2,
      load: 1,
      priority: 1,
    },
    {
      id: "t-slides",
      title: "讲稿排练（不可中断）",
      duration: 6,
      splittable: false,
      minBlock: 6,
      load: 3,
      priority: 3,
      deadline: at(3, 0),
      hardDeadline: true,
    },
  ],
  meetings: [
    { id: "m-standup", title: "晨会", start: at(0, 9), end: at(0, 9.5) },
    { id: "m-1on1", title: "1on1", start: at(0, 14), end: at(0, 15) },
    { id: "m-review", title: "评审会", start: at(1, 10), end: at(1, 11.5) },
  ],
};

// ---------- 渲染 ----------

function el(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function fmtSlot(slot: number): string {
  const spd = slotsPerDay(cfg);
  const day = Math.floor(slot / spd);
  const h = (slot % spd) / cfg.slotsPerHour;
  const hh = String(Math.floor(h)).padStart(2, "0");
  const mm = String(Math.round((h % 1) * 60)).padStart(2, "0");
  return `${dayLabel(day)} ${hh}:${mm}`;
}

function energyBg(e: number): string {
  // 低能 → 冷灰，高能 → 暖黄：调度员一眼看出"发电曲线"
  const l = 97 - (e / 100) * 22;
  return `hsl(${45 + (1 - e / 100) * 170} ${30 + (e / 100) * 60}% ${l}%)`;
}

function renderCurvePicker(state: AppState): HTMLElement {
  const labels: Record<string, string> = {
    "early-bird": "早鸟（上午峰）",
    "night-owl": "夜猫（夜间峰）",
    "twin-peaks": "双峰（10 点 + 16 点）",
  };
  const node = el(`<div class="curve-picker">
    <h3>精力曲线</h3>
    <div class="curve-options">${TEMPLATES.map(
      (c) => `
      <label class="${c.name === state.curveName ? "active" : ""}">
        <input type="radio" name="curve" value="${c.name}" ${c.name === state.curveName ? "checked" : ""}/>
        ${labels[c.name] ?? c.name}
      </label>`,
    ).join("")}</div>
  </div>`);
  return node;
}

function renderTaskForm(): HTMLElement {
  const dayOptions = Array.from(
    { length: cfg.horizonDays },
    (_, d) => `<option value="${d}">${dayLabel(d)}</option>`,
  ).join("");
  return el(`<form id="task-form" class="entity-form">
    <h3>添加任务</h3>
    <input name="title" placeholder="任务名" required maxlength="40" />
    <div class="row">
      <label>工期
        <select name="duration">
          ${[0.5, 1, 1.5, 2, 3, 4].map((h) => `<option value="${h * 4}" ${h === 1 ? "selected" : ""}>${h}h</option>`).join("")}
        </select>
      </label>
      <label>负载
        <select name="load">
          <option value="1">轻</option><option value="2" selected>中</option><option value="3">深度</option>
        </select>
      </label>
      <label>优先级
        <select name="priority">
          <option value="1">低</option><option value="2" selected>中</option><option value="3">高</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label><input type="checkbox" name="splittable" checked /> 可拆分</label>
      <label>最小块
        <select name="minBlock">
          ${[0.5, 1, 1.5].map((h) => `<option value="${h * 4}" ${h === 0.5 ? "selected" : ""}>${h}h</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="row">
      <label><input type="checkbox" name="hasDeadline" /> 截止</label>
      <select name="deadlineDay">${dayOptions}</select>
      <select name="deadlineHour">${Array.from({ length: 17 }, (_, i) => `<option value="${i + 7}" ${i + 7 === 18 ? "selected" : ""}>${i + 7}:00</option>`).join("")}</select>
      <label><input type="checkbox" name="hardDeadline" /> 硬截止</label>
    </div>
    <button type="submit">＋ 添加任务</button>
  </form>`);
}

function renderMeetingForm(): HTMLElement {
  const dayOptions = Array.from(
    { length: cfg.horizonDays },
    (_, d) => `<option value="${d}">${dayLabel(d)}</option>`,
  ).join("");
  const hourOptions = (sel: number) =>
    Array.from({ length: 33 }, (_, i) => 7 + i * 0.5)
      .map(
        (h) =>
          `<option value="${h}" ${h === sel ? "selected" : ""}>${Math.floor(h)}:${h % 1 ? "30" : "00"}</option>`,
      )
      .join("");
  return el(`<form id="meeting-form" class="entity-form">
    <h3>添加会议（基荷）</h3>
    <input name="title" placeholder="会议名" required maxlength="40" />
    <div class="row">
      <select name="day">${dayOptions}</select>
      <select name="startHour">${hourOptions(10)}</select>
      <span>→</span>
      <select name="endHour">${hourOptions(11)}</select>
    </div>
    <button type="submit">＋ 添加会议</button>
  </form>`);
}

function renderLists(state: AppState): HTMLElement {
  const loadLabel = ["", "轻", "中", "深度"];
  const tasks = state.tasks
    .map(
      (t, i) => `<li>
        <span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
        <span class="name">${esc(t.title)}</span>
        <span class="meta">${t.duration / 4}h · ${loadLabel[t.load]} · P${t.priority}${
          t.deadline !== undefined
            ? ` · ${t.hardDeadline ? "硬" : ""}截止 ${fmtSlot(t.deadline)}`
            : ""
        }${t.splittable ? "" : " · 不可拆"}</span>
        <button data-del-task="${t.id}" title="删除">✕</button>
      </li>`,
    )
    .join("");
  const meetings = state.meetings
    .map(
      (m) => `<li>
        <span class="dot meeting-dot"></span>
        <span class="name">${esc(m.title)}</span>
        <span class="meta">${fmtSlot(m.start)} – ${fmtSlot(m.end).split(" ").pop()}</span>
        <button data-del-meeting="${m.id}" title="删除">✕</button>
      </li>`,
    )
    .join("");
  return el(`<div class="lists">
    <ul class="entity-list">${tasks || '<li class="empty">还没有任务 — 添加任务或点「载入示例」</li>'}</ul>
    <ul class="entity-list">${meetings || '<li class="empty">没有会议</li>'}</ul>
  </div>`);
}

function renderGrid(state: AppState, ui: UiState): HTMLElement {
  const scenario = toScenario(state);
  const spd = slotsPerDay(cfg);
  const wakeStart = cfg.wakeStartHour * cfg.slotsPerHour;
  const wakeSlots = (cfg.wakeEndHour - cfg.wakeStartHour) * cfg.slotsPerHour;
  const colorOf = new Map(
    state.tasks.map((t, i) => [t.id, PALETTE[i % PALETTE.length]]),
  );
  const titleOf = new Map(state.tasks.map((t) => [t.id, t.title]));
  const schedule = ui.schedule;

  let header = `<div class="grid-row grid-header"><div class="day-label"></div>`;
  for (let h = cfg.wakeStartHour; h < cfg.wakeEndHour; h++) {
    header += `<div class="hour-label" style="grid-column: span ${cfg.slotsPerHour}">${h % 2 === 1 ? h : ""}</div>`;
  }
  header += `</div>`;

  let rows = "";
  for (let d = 0; d < cfg.horizonDays; d++) {
    let cells = "";
    for (
      let s = d * spd + wakeStart;
      s < d * spd + wakeStart + wakeSlots;
      s++
    ) {
      const e = energyAtSlot(scenario.curve, s, cfg);
      const meeting = state.meetings.find((m) => s >= m.start && s < m.end);
      const block = schedule?.blocks.find((b) => s >= b.start && s < b.end);
      let inner = "";
      let style = `background:${energyBg(e)}`;
      let cls = "cell";
      let tip = `${fmtSlot(s)} · 精力 ${Math.round(e)}`;
      if (meeting) {
        cls += " cell-meeting";
        style = "";
        tip = `${esc(meeting.title)} · ${fmtSlot(s)}`;
      } else if (block) {
        cls += " cell-task";
        style = `background:${colorOf.get(block.taskId) ?? "#555"}`;
        tip = `${esc(titleOf.get(block.taskId) ?? block.taskId)} · ${fmtSlot(s)}`;
        if (s === block.start)
          inner = `<span class="block-tag">${esc((titleOf.get(block.taskId) ?? "?").slice(0, 6))}</span>`;
      }
      cells += `<div class="${cls}" style="${style}" title="${tip}">${inner}</div>`;
    }
    rows += `<div class="grid-row"><div class="day-label">${dayLabel(d)}</div>${cells}</div>`;
  }

  const dropped =
    schedule && schedule.dropped.length > 0
      ? `<div class="dropped">${schedule.dropped
          .map(
            (dr) =>
              `<div>✗ 放弃「${esc(titleOf.get(dr.taskId) ?? dr.taskId)}」— ${esc(dr.reason)}</div>`,
          )
          .join("")}</div>`
      : "";
  const score =
    schedule !== null
      ? `<div class="score">目标 B 得分：<strong>${objectiveB(scenario, schedule, cfg).toFixed(2)}</strong>（深度块 × 高能时段的匹配度，越高越好）</div>`
      : `<div class="score muted">点「⚡ 求解」生成日程</div>`;

  return el(`<div class="grid-panel">
    <div class="grid-toolbar">
      <button id="solve-btn" class="primary">⚡ 求解（re-dispatch）</button>
      <button id="export-btn" ${schedule ? "" : "disabled"}>⬇ 导出 .ics</button>
      <label class="file-btn">⬆ 导入日历 .ics<input id="import-input" type="file" accept=".ics,text/calendar" hidden /></label>
      <button id="sample-btn">载入示例</button>
      <button id="clear-btn" class="danger">清空</button>
    </div>
    ${ui.error ? `<div class="error">${esc(ui.error)}</div>` : ""}
    <div class="grid">${header}${rows}</div>
    ${dropped}${score}
    <p class="hint">背景色 = 你的精力曲线（暖黄为高能区）；深度任务只会被排进高能时隙；任务块之间自动留 15 分钟缓冲；每日只调度可用时间的 70%。导出 .ics 后导入 Google/Apple 日历即可在手机查看计划；导入 .ics 会把日历事件作为会议基荷（全天/循环事件暂不支持）。数据全部存在本机浏览器。</p>
  </div>`);
}

// ---------- 事件与主循环 ----------

const state = loadState();
const ui: UiState = { schedule: null, error: null };
const root = document.getElementById("app");
if (!root) throw new Error("missing #app");

function resolveNow(): void {
  if (state.tasks.length === 0) {
    ui.schedule = null;
    ui.error = "请先添加至少一个任务";
    return;
  }
  try {
    ui.schedule = solve(toScenario(state), cfg);
    ui.error = null;
  } catch (err) {
    ui.schedule = null;
    ui.error = `求解失败：${err instanceof Error ? err.message : String(err)}`;
  }
}

function render(): void {
  if (!root) return;
  root.replaceChildren();
  root.append(
    el(`<header class="app-header">
      <h1>⚡ 时间电网 <span>Time Grid</span></h1>
      <p>任务是负载，精力是发电曲线，会议是基荷 —— 让求解器替你排日程。</p>
    </header>`),
  );
  const layout = el(`<main class="layout"></main>`);
  const side = el(`<aside class="side"></aside>`);
  side.append(
    renderCurvePicker(state),
    renderTaskForm(),
    renderMeetingForm(),
    renderLists(state),
  );
  layout.append(side, renderGrid(state, ui));
  root.append(layout);
  wire();
}

function wire(): void {
  document
    .querySelectorAll<HTMLInputElement>('input[name="curve"]')
    .forEach((input) => {
      input.addEventListener("change", () => {
        state.curveName = input.value;
        saveState(state);
        if (ui.schedule) resolveNow();
        render();
      });
    });

  document.getElementById("task-form")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target as HTMLFormElement);
    const duration = Number(f.get("duration"));
    const splittable = f.get("splittable") === "on";
    const hasDeadline = f.get("hasDeadline") === "on";
    const task: Task = {
      id: `t-${crypto.randomUUID().slice(0, 8)}`,
      title: String(f.get("title") ?? "").trim() || "未命名任务",
      duration,
      splittable,
      minBlock: splittable
        ? Math.min(Number(f.get("minBlock")), duration)
        : duration,
      load: Number(f.get("load")) as Task["load"],
      priority: Number(f.get("priority")) as Task["priority"],
    };
    if (hasDeadline) {
      task.deadline = at(
        Number(f.get("deadlineDay")),
        Number(f.get("deadlineHour")),
        cfg,
      );
      task.hardDeadline = f.get("hardDeadline") === "on";
    }
    state.tasks.push(task);
    saveState(state);
    if (ui.schedule) resolveNow();
    render();
  });

  document.getElementById("meeting-form")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target as HTMLFormElement);
    const day = Number(f.get("day"));
    const start = at(day, Number(f.get("startHour")), cfg);
    const end = at(day, Number(f.get("endHour")), cfg);
    if (end <= start) {
      ui.error = "会议结束时间必须晚于开始时间";
      render();
      return;
    }
    state.meetings.push({
      id: `m-${crypto.randomUUID().slice(0, 8)}`,
      title: String(f.get("title") ?? "").trim() || "未命名会议",
      start,
      end,
    });
    saveState(state);
    if (ui.schedule) resolveNow();
    render();
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-del-task]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        state.tasks = state.tasks.filter((t) => t.id !== btn.dataset.delTask);
        saveState(state);
        if (ui.schedule) resolveNow();
        render();
      });
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-del-meeting]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        state.meetings = state.meetings.filter(
          (m) => m.id !== btn.dataset.delMeeting,
        );
        saveState(state);
        if (ui.schedule) resolveNow();
        render();
      });
    });

  document.getElementById("solve-btn")?.addEventListener("click", () => {
    resolveNow();
    render();
  });
  document.getElementById("export-btn")?.addEventListener("click", () => {
    if (!ui.schedule) return;
    const ics = scheduleToICS(ui.schedule, state.tasks, ANCHOR, cfg);
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "time-grid.ics";
    a.click();
    URL.revokeObjectURL(url);
  });

  document
    .getElementById("import-input")
    ?.addEventListener("change", async (ev) => {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { events, skipped } = parseICS(await file.text(), ANCHOR, cfg);
        for (const e of events) {
          state.meetings.push({
            id: `m-${crypto.randomUUID().slice(0, 8)}`,
            title: e.title,
            start: e.start,
            end: e.end,
          });
        }
        saveState(state);
        if (events.length > 0 && ui.schedule) resolveNow();
        // 求解成功会清空 ui.error，导入提示必须在其后写入
        ui.error =
          events.length === 0
            ? `未导入任何事件${skipped > 0 ? `（${skipped} 个事件被跳过：全天/循环/地平线外）` : ""}`
            : skipped > 0
              ? `已导入 ${events.length} 个会议，跳过 ${skipped} 个（全天/循环/地平线外）`
              : ui.error;
      } catch (err) {
        ui.error = `导入失败：${err instanceof Error ? err.message : String(err)}`;
      }
      input.value = "";
      render();
    });

  document.getElementById("sample-btn")?.addEventListener("click", () => {
    state.tasks = SAMPLE.tasks.map((t) => ({ ...t }));
    state.meetings = SAMPLE.meetings.map((m) => ({ ...m }));
    saveState(state);
    resolveNow();
    render();
  });
  document.getElementById("clear-btn")?.addEventListener("click", () => {
    state.tasks = [];
    state.meetings = [];
    ui.schedule = null;
    ui.error = null;
    saveState(state);
    render();
  });
}

render();

// PWA：仅生产环境注册 Service Worker（离线可用）
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // 离线能力是渐进增强，注册失败不影响核心功能
  });
}
