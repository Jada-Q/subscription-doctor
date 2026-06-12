# Time Grid — 个人「时间电网」调度器（求解核心）

把日程管理建模为电网经济调度问题：**任务 = 负载**（工期、截止、可中断性），**精力 = 发电曲线**（昼夜节律），**会议 = 不可中断基荷**。本目录是 [05 号计划](../../docs/project-plans/05-time-grid-scheduler.md) Phase 1 的交付物：纯 TypeScript 求解核心，无 UI。

## 当前实现（Phase 1）

- **数据模型** `src/types.ts` — Task / Meeting / EnergyCurve / Schedule，15 分钟时隙离散化
- **精力曲线** `src/energy.ts` — 早鸟 / 夜猫 / 双峰三条预设模板 + 分段线性插值
- **可行性校验器** `src/validator.ts` — C1–C8 全部约束的独立裁判（所有求解器共用）
- **目标函数** `src/objective.ts` — 目标 B：深度块长 × 精力匹配的超线性奖励 − 延误 − 碎片 − 丢弃
- **贪心启发式** `src/greedy.ts` — 深度任务抢占高能时隙、轻任务让出高能区、可拆任务填缝、超载优雅降级
- **局部搜索** `src/localSearch.ts` — 移动 / 交换 / 合并三种邻域动作的爬山（种子化随机，结果可复现）
- **滚动重排** `src/redispatch.ts` — 锁定过去时隙、只重排未来，附计划稳定性度量
- **场景库** `src/scenarios.ts` — 8 个固定测试场景（轻载日、会议密集、双硬截止、夜猫深度、不可拆长任务、碎片填缝、超载不可行、7 天滚动）

## 运行

依赖复用仓库根目录的 vitest / typescript，无需单独安装：

```bash
# 测试（在仓库根目录执行）
npx vitest run -c projects/time-grid/vitest.config.ts

# ASCII 甘特演示（Node 22+ 直接跑 TS）
node projects/time-grid/src/demo.ts

# Web UI（Phase 2，在 projects/time-grid 下）
npm install && npm run dev      # 开发
npm run build && npm run preview  # 生产构建预览
```

## Web UI（Phase 2 已交付）

`src/ui/` — Vite + 原生 TypeScript（无框架，gzip 后 ~9KB）：任务/会议 CRUD、三条精力曲线切换、
时间网格视图（精力曲线为背景色、任务块着色、会议为斜纹基荷）、一键求解 / re-dispatch、
丢弃任务告警、目标 B 得分展示。状态存 localStorage，全部端侧。

## 产品闭环（Phase 3 已交付）

- **真实日期锚定**：第 0 天 = 今天，网格/表单/列表全部显示实际日期
- **ICS 导出**（`src/ics.ts`）：求解结果一键下载 `.ics`，导入 Google/Apple 日历即可在手机查看计划；
  UID 带任务 ID，重排后重新导入可被日历客户端覆盖
- **ICS 导入**：日历导出的 `.ics` 拖给文件选择器 → 事件成为会议基荷并自动重排；
  全天/循环/地平线外事件显式提示跳过数量，绝不静默丢弃（MVP 限制：RRULE 不展开、TZID 按本地时间解析）
- **PWA**：manifest + Service Worker 运行时缓存，可安装、离线可用

部署：`npm run build` 产出 `dist/` 纯静态站，任何静态托管（Vercel/Netlify/GitHub Pages）直接可用，无服务端。

## 精力被动标定（计划 §5 Level 2，已交付）

`src/calibration.ts` — 标记任务完成时弹"单击即走"微调查（🔥/😐/🥱）：

- 按小时桶 EMA 更新（η=0.3），反馈记录在完成时刻的小时
- 抗噪：单桶 3 次反馈才到满权重；总样本 < 10 次时整体只与模板混合、不覆盖（贝叶斯式先验）
- 曲线说明显示"已融合你的 N 次状态反馈"（留存钩子），可一键重置回模板
- 标定后自动重排：深度任务会迁移到你实际报告高能的时段

## 设计要点

- 时隙 Δ=15min，清醒窗口默认 7:00–23:00（64 槽/天），地平线 7 天
- 深度任务（load=3）只允许排进精力 ≥ 65 的时隙（约束 C6）
- 任务块之间强制 ≥1 槽缓冲（约束 C7 的实现形式，对抗"计划-现实鸿沟"）
- 每日只调度可用时间的 70%（`dailyLoadFactor`，内置松弛）
- 超载时不崩溃：丢弃最低优先级任务并在 `schedule.dropped` 中报告原因

## Backlog（后续 Phase）

- Phase 2: highs-js（HiGHS WASM）MILP 精解 + 时间网格 UI + IndexedDB
- Phase 1 收尾项: Python CP-SAT 离线基准（`bench/cpsat_baseline.py`），度量启发式最优性间隙
- Phase 3: ICS 导入/导出（ical.js）、精力被动标定闭环、PWA

<!-- deploy: retry-after-pages-enabled -->
