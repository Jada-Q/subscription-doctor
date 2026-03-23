# Subscription Doctor (订阅医生) — 正式项目执行方案

**版本**: v1.4（最终执行版） | **日期**: 2026-03-23 | **创始人**: Jada | **状态**: MVP 开发启动

---

## 一、项目定位

> 日本市场首个「隐私优先」的 AI 账单审计工具：一张截图，揪出苹果税、标记重复订阅、量化隐形支出。

**已验证价值**：创始人个人优化账单，年省 17,900 JPY。

---

## 二、市场机会与竞品

### 赛道验证
- Rocket Money 被以 **$12.75亿** 收购（2021），累计为用户省 $25亿+
- 日本市场无直接竞品覆盖「苹果税检测 + 本地化」
- 日本订阅市场已超 **1万亿日元**（FY2025），CAGR 41%
- 现有日本竞品（サブスク管理、SubsHub）全是手动录入，无 OCR/AI
- Apple 2025.12 执行日本 MSCA 法案，替代支付佣金降至 **10-15%**（远期利好）

### 竞品对比

| 产品 | 市场 | 核心能力 | 我们的差异 |
|------|------|----------|-----------|
| **Rocket Money** | 美国 | 银行API直连、代取消 | 不支持日本、需连接银行（隐私差） |
| **Trim** | 美国 | 交易扫描、短信取消 | 不支持日本 |
| **Pine AI** | 美国 | AI 代打客服电话 | 无截图分析、英语市场 |
| **Wallos** (开源) | 全球 | 自托管订阅追踪 | 手动录入、无 OCR、无苹果税检测 |
| **freee/MF** | 日本 | 云会计+确定申告 | 面向专业用户、不做订阅审计 |

**核心差异化**：Rocket Money = 美国+银行API | Subscription Doctor = 日本+截图本地分析+苹果税检测+隐私优先

---

## 三、V1 产品范围

### MVP（v1.0）— 6 个核心模块 + Demo

| # | 模块 | 说明 |
|---|------|------|
| 1 | 截图上传 | JPG/PNG/HEIC，压缩到 500KB，UI 引导上传截图而非拍照 |
| 2 | OCR 识别 | **双引擎**：桌面用 PaddleOCR 系 / 移动 Safari 用 Tesseract.js |
| 3 | 文字结构化 | 全角→半角标准化 + **发卡机构选择**（楽天/SMBC/JCB 等专用解析规则） |
| 4 | 规则库匹配 | **本地 JSON 文件，初版 10 个服务**（不依赖 Supabase） |
| 5 | 苹果税检测 | App Store 价 vs 官网价，价格数据标注为"社区众包" |
| 6 | 重复检测（简化） | 仅 cloud_storage 组（iCloud vs Google Drive） |
| 8 | 健康报告 | 评分 + 年度浪费金额 + 可分享卡片 |
| Demo | Demo 模式 | 预加载假数据，Landing page 直接展示价值（不需上传） |

> **v1.0 不含模块 7（敏感遮盖）**：数据完全在浏览器本地处理，不上传服务器，Alpha 阶段不需要。

### v1.1（Alpha 后 2-3 周追加）
- 模块 7：敏感数据遮盖（卡号/姓名/地址）
- 模块 9：用户手动修正 + 反馈循环（含独立数据同意弹窗）
- 模块 10：本地历史存储（IndexedDB，需 feature detect 隐私模式）
- 模块 11：AI Fallback（Gemini 2.5 Flash-Lite 免费层，含 prompt sanitize + Zod 校验）
- 重复检测扩展（music/video/ai 组）
- Supabase 迁移（规则库热更新 + 用户反馈存储 + RLS + 审计表）

### 不做
- ❌ 自动取消订阅
- ❌ 保险审计（合规复杂）
- ❌ 确定申告助手（法律风险，V2 考虑）
- ❌ 多语言（V1 仅日文）
- ❌ 原生 App（先 Web/PWA）

---

## 四、技术架构

### 核心决策：本地 OCR + 规则库（MVP 零后端依赖）

| 对比项 | 纯 Gemini | 本方案（混合） |
|-------|---------|---------|
| 年成本 | $4,800 | **$0-240（MVP）** |
| 初期准度 | 95% | 85%（+用户修正→实际~95%） |
| 隐私 | ❌ 截图上传云端 | ✅ 截图不离开设备 |
| 护城河 | ❌ 任何人能调 API | ✅ 自建规则库 |

### 技术栈

| 层级 | 选型 | 月成本 |
|------|------|--------|
| 框架 | Next.js (React, App Router, TypeScript) | $0 |
| OCR | **双引擎**：PaddleOCR 系(桌面) + Tesseract.js(移动) | $0 |
| 图片压缩 | Pica | $0 |
| HEIC 转换 | `@tuily/heic2any`（Safari 修复版 fork） | $0 |
| 规则库 | **本地 JSON**（MVP）→ Supabase PostgreSQL（v1.1） | $0 → $25 |
| AI fallback | Gemini 2.5 Flash-Lite 免费层（v1.1 启用） | $0 |
| 部署 | Vercel | $0-20 |
| 监控 | Sentry 免费层 | $0 |
| **MVP 总计** | | **$0-20/月** |

### 致命技术风险（已解决）

**FATAL-1：「PaddleOCR.js」不是真实的 npm 包** ✅ **已验证 (2026-03-23)**
选定 `paddleocr` 1.1.1（X3ZvaWQ）+ PP-OCRv5 模型。Spike 测试结果：
- PaddleOCR v5：**96.2% 信頼度、1.9秒**，日文/日期/金额全部正确识别
- Tesseract.js v7：79.0% 信頼度、1.9秒，¥符号误识别(\t)、日期合并、日文多余空格
- `client-side-ocr` 排除：不是库而是完整应用（含 React/Mantine UI 依赖）
- **关键发现**：辞書文件 `ppocrv5_dict.txt` 第1行为空行（CTC blank token），不可过滤

**FATAL-2：iOS Safari + ONNX Runtime 崩溃** ✅ **已推翻 (2026-03-23)**
实测结果：PaddleOCR + onnxruntime-web 在 iPhone Safari **正常运行**。
- 设置 `numThreads: 1` + WASM backend → 无崩溃
- iPhone 处理速度：demo 图 1.3s / 实拍照 2.9s（目标 <6s 大幅通过）
- Tesseract.js 在 iPhone 上 10.7s → 不可用
- **结论：双引擎不需要 → PaddleOCR 一本化，删除 Tesseract.js 依赖**
- **注意：Next.js 16 Turbopack dev 模式输出 iOS 不兼容的 JS，必须用 production build 测试**

**FATAL-3：heic2any 在 Safari 失效**
iPhone 拍照默认 HEIC，但 `heic2any` 在 Safari 不工作。
→ UI 引导上传**截图**（PNG）+ 使用修复版 fork `@tuily/heic2any` + 功能检测。

### 架构流程
```
用户上传截图（引导截图而非拍照）
  ↓
[浏览器] Pica 压缩到 500KB + HEIC 转换（如需）
  ↓
[浏览器] OCR 双引擎（桌面: PaddleOCR 系 / 移动: Tesseract.js）
  ↓
[浏览器] 发卡机构专用解析 → 文字标准化 → 交易结构化
  ↓
[浏览器] 本地 JSON 规则库匹配 → 苹果税检测 → 重复检测
  ↓
[浏览器] 生成「订阅体检报告」→ 分享卡片
  ↓ (v1.1)
[后端] 未匹配项 → Gemini Flash-Lite fallback → 用户修正 → 反馈进规则库
```

### AI 模型策略

| 阶段 | 模型 | Model ID | 月成本 | 备注 |
|------|------|----------|--------|------|
| MVP | 无 AI（标记 unmatched） | — | $0 | 纯本地 |
| v1.1 | Gemini 2.5 Flash-Lite 免费层 | `gemini-2.5-flash-lite` | $0 | 2026-07-22 退役 |
| 迁移 | Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | $0 | 长期替代 |
| 增长期 | GPT-4o-mini 或 Gemini 付费层 | — | $1-10 | 付费用户覆盖 |

> **关键**：Model ID 通过环境变量 `GEMINI_MODEL_ID` 配置，不硬编码。
> **注意**：Gemini 免费层数据可能被 Google 用于训练（但仅发送脱敏文本）；Plus 用户切换付费层。

---

## 五、规则库（核心数据资产）

### MVP 初版：10 个服务（本地 JSON）

覆盖 ~70% 常见匹配的核心服务：

| 服务 | 关键词 | App Store 价 | 官网价 | 类别 |
|------|--------|-------------|--------|------|
| Apple iCloud 2TB | APPLE COM BILL | ¥1,300 | ¥1,300 | cloud_storage |
| Netflix Standard | NETFLIX | ¥1,590 | ¥1,490 | streaming |
| Spotify Premium | SPOTIFY | ¥980 | ¥980 | music |
| YouTube Premium | GOOGLE YOUTUBE | ¥1,280 | ¥1,180 | streaming |
| Amazon Prime | AMAZON PRIME | ¥600 | ¥600 | streaming |
| Apple Music | APPLE COM BILL | ¥1,080 | ¥1,080 | music |
| Disney+ | DISNEY PLUS | ¥990 | ¥990 | streaming |
| ChatGPT Plus | OPENAI | ¥3,000 | $20 | ai |
| Adobe CC | ADOBE | ¥2,728 | ¥2,728 | productivity |
| Microsoft 365 | MICROSOFT | ¥1,490 | ¥1,284 | productivity |

> 每个规则含 `billingCycle: "monthly" | "annual"` 字段，避免年费 ×12 过度计算。

### v1.1：扩展到 30 服务（迁移到 Supabase）

新增：Google One, OneDrive, Dropbox, Hulu JP, U-NEXT, Nintendo Online, PlayStation Plus, DMM, dアニメストア, Claude Pro, Notion 等。

### 维护策略
1. MVP 初版：手动录入 10 个服务（1 人 × 1 天）
2. Alpha 后：用户修正众包（同一修正 3+ 人 → 候选规则）
3. v1.1 后：GitHub Actions 自动化 → PR 审核 → 部署到 Supabase

---

## 六、营销策略

### 病毒传播：「订阅体检报告」
生成可分享卡片（1200×630）：健康评分 + 可节省金额（**不含具体服务名** → 降低日本用户分享心理门槛）
底部：「あなたも診断する → subsc-doctor.jp」+ 二维码

### 四阶段推广路线（¥0 起步）

**Phase 1：内容铺垫（W1-W2，¥0）**

| 平台 | 内容 |
|------|------|
| Qiita + Zenn | 技术文章「ブラウザ OCR で日本語レシートを読み取る」 |
| note.com（700万MAU） | 科普「あなたが気づかない年間2万円のApple税」 |
| Twitter/X（7,120万用户） | 每日订阅节省 tip，#サブスク見直し |

**Phase 2：Beta 招募（W3-W4，¥0）**

| 平台 | 内容 |
|------|------|
| r/JapanFinance（13.5万+） | "Free tool to detect subscription overcharges - beta" |
| Twitter/X | Beta テスター募集 |
| Discord 个人理财社区 | 分享 Beta 链接 |

**Phase 3：正式发布（W5-W6，¥0-33,000）**

| 平台 | 成本 |
|------|------|
| Product Hunt | ¥0（日本时间 17:01 发布 = PH 日更新时间） |
| PR TIMES（可选） | ¥33,000/次 |
| TikTok / YouTube Shorts | ¥0（"30秒でサブスクの無駄を発見" 演示视频） |

**Phase 4：持续增长 + 確定申告季（¥0-50,000/月）**
- Twitter 每日教育内容 + note.com 每周深度文 + TikTok 每周 2-3 短视频
- **2027 年 1-3 月確定申告季**：SEO 提前 2 个月准备「確定申告 サブスク」内容

### 关键 SEO 词（已验证有搜索量）

`サブスク 見直し` `サブスク 節約` `Apple税` `確定申告 サブスク` `サブスク管理 アプリ` `不要なサブスク`

### 定价（上线后 A/B 测试 3 档）
| 层级 | 价格 | 内容 |
|------|------|------|
| Free | ¥0 | 首次完整分析 + 每月 1 次追踪扫描（含苹果税检测 + 年度浪费总额展示） |
| Plus | ¥300/¥500/¥980（A/B 测试） | 无限分析 + AI增强 + 月度监控 + 具体取消建议 |
| 確定申告パック | ¥2,000/年（V2） | Plus + 医療費/経費自動分類 |

> **定价原则**：Free 层必须让用户立即看到"あなたは年間 ¥X 余分に払っています"，行动建议锁在 Plus 层。

---

## 七、法规合规

| 法规 | 风险 | 应对 | 时间节点 |
|------|------|------|----------|
| 個人情報保護法 (PIPA) | 🔴 高 | Alpha 前完成プライバシーポリシー；正式版前做 PIPA 审计（预算 ¥300,000-500,000） | Alpha 前 |
| Apple ToS | 🟡 中 | 价格数据标注为"社区众包"，不直接爬取 App Store | MVP |
| 税理士法 | 🔴 高 | V1 不做报税；V2 增加固定 disclaimer，不使用"申告""控除"等法律术语作功能名 | V2 |
| 金融商品取引法 | 🔴 高 | 不做保险推荐 | 远期 |
| 特定商取引法 | 🟡 中 | Plus 上线前完成：退款政策、8天冷静期、事业者信息公示 | Plus 上线前 |

**PIPA 必须项（Alpha 前）**：
- ✍️ 正式的プライバシーポリシー
- 📋 数据处理流程图（哪些数据在哪里处理、保留多久）
- 👤 用户权利实现（数据访问权、删除权）
- 🔐 用户修正数据上报需**独立同意弹窗**（不能藏在 ToS 里）

---

## 八、开发时间表

### Phase 1：MVP — 6 周（含 OCR 风险消除）

| 周 | 开发 | 推广 | 交付物 |
|----|------|------|--------|
| **W1** | OCR Spike(Day1-3) + 模块 1 图片上传 + Sentry 接入 | 注册 Qiita/Zenn/note/X | ✅ OCR 引擎选型确定 |
| **W2** | 模块 2 OCR 集成 + 模块 3 结构化 + Demo 数据 | Qiita 技术文章 | ✅ Phase 0.5 可展示 |
| **W3** | 模块 4 规则库(10 服务 JSON) + 模块 5 苹果税 | note.com Apple 税科普 | ✅ 核心价值链跑通 |
| **W4** | 模块 6 简化 + 模块 8 报告 + 分享卡片 | Twitter 预热 | ✅ 完整报告可生成 |
| **W5** | 安全加固(HTTPS/CSP/Rate Limit) + 隐私政策 + Landing page + 测试 | Beta 招募 | ✅ 阻断项通过 |
| **W6** | Bug 修复 + Alpha 上线 | Product Hunt | ✅ Alpha live |

#### W1 OCR Spike 详细步骤（最高优先级风险消除）
```
Day 1：收集 5-10 张真实日文信用卡账单截图（楽天、SMBC、JCB）
       安装 tesseract.js + client-side-ocr
       简单 HTML 页面测试两个库准确率和速度（Mac Chrome）

Day 2：iPhone Safari 测试（ngrok 暴露本地服务）
       HEIC 上传测试（拍照 vs 截图）
       记录：准确率、速度、内存占用、是否崩溃

Day 3：做出引擎决策 → 更新技术文档
       如果两个都不行 → 评估服务端 OCR fallback
```

### Phase 1.5：v1.1 补全（第 7-8 周）
- 模块 7（敏感遮盖：卡号/姓名/地址）
- 模块 9（用户修正 + 独立数据同意）
- 模块 10（IndexedDB 本地历史 + 隐私模式 feature detect）
- 模块 11（Gemini Flash-Lite fallback + prompt sanitize + Zod 校验）
- Supabase 迁移（规则库 + 反馈 + RLS + 审计）

### Phase 2：增长验证（第 9-14 周）
- 收集 50 个真实用户反馈
- 验证 Free→Paid 转化率（目标 ≥ 3%）
- 付费功能上线（A/B 测试 3 档定价）

### Phase 3：扩展（第 15-26 周）
- 確定申告模块（2027 年 1 月前完成，赶报税季 SEO）
- PWA 化
- B2B2C 探索（3-5 家税理士事务所访谈）

### 里程碑
| 里程碑 | 目标日期 |
|--------|----------|
| OCR Spike 完成 | 2026-03-28 |
| Alpha 上线 | 2026-05-04（6 周后） |
| v1.1 补全 | 2026-05-18 |
| 50 个真实用户 | 2026-06-15 |
| 付费功能 + A/B 测试 | 2026-07-01 |
| 1,000 用户 | 2026-09-30 |
| 確定申告模块 | 2027-01-31 |

---

## 九、成本与收入

### 运营成本

| 项目 | MVP 阶段 | v1.1 后 | 增长阶段 |
|------|---------|---------|---------|
| Supabase | $0（本地 JSON） | $25 | $25 |
| AI 模型 | $0（无 AI） | $0（Gemini 免费层） | $1-10 |
| Vercel | $0 | $0-20 | $20 |
| Sentry | $0（免费层） | $0 | $26 |
| 域名 | $1 | $1 | $1 |
| **月总计** | **$1** | **$26-46** | **$73-82** |
| **年总计** | **$12** | **$312-552** | **$876-984** |

**一次性成本**：
- PIPA 审计：¥300,000-500,000（正式版前）
- PR TIMES 新闻稿：¥33,000（可选）

### 收入预测（按 3% 转化率 + 20% 年流失修正）

| 指标 | 6个月后 | 12个月后 |
|------|---------|----------|
| Free 用户 | 1,000 | 5,000 |
| Paid 转化率 | 3% | 3% |
| 新增 Paid | 30 | 150 |
| 年流失 20% 后 | 30 | ~125 |
| 年收入（¥5,000/人） | **¥150,000** | **¥625,000** |

### 单位经济学
- LTV = ¥5,000/年 × 2.5 年平均留存 = **¥12,500**
- 目标 CAC < **¥3,000**（LTV/CAC > 4:1）
- 盈亏平衡：~20 Paid 用户（月收入 ≥ 月成本）

### 策略：自力启动到 PMF，用真实转化率数据决定是否追加投入

---

## 十、风险管理

| 风险 | 概率 | 应对 |
|------|------|------|
| OCR 库不可用/准度不足 | 高 | **W1 OCR Spike 消除**；双引擎架构（PaddleOCR 系 + Tesseract.js）；服务端 OCR 作最终 fallback |
| 规则库过时 | 高 | 众包反馈 + GitHub Actions 自动化更新流程 |
| freee/MF 进入赛道 | 中 | 护城河窗口期约 6-12 个月；Phase 2 起建立品牌 + 社区（非纯功能护城河） |
| 用户不愿上传截图 | 中 | 全程本地处理 + UI 展示数据流透明图 |
| 日本用户付费意愿低 | 高 | Free 层展示浪费金额（不锁），Plus 层提供行动建议 |
| Supabase 单点故障 | 低 | 规则库做本地 JSON 降级；Supabase 不可用仅影响反馈 + Haiku |
| PIPA 合规不足 | 高 | Alpha 前完成隐私政策；正式版前 PIPA 审计 |
| 增长瓶颈（价值感知） | 高 | 报告必须立刻展示"你多付了 ¥X"，不能只列订阅清单 |

### 降级策略
| 故障 | 影响 | 降级方案 |
|------|------|---------|
| PaddleOCR 系加载失败 | 桌面用户 | 自动 fallback 到 Tesseract.js |
| Tesseract.js 加载失败 | 移动用户 | 提示刷新 → 提示更换浏览器 |
| iOS Safari ONNX 崩溃 | iPhone 用户 | 自动检测 → 直接用 Tesseract.js |
| Supabase 不可用（v1.1） | 规则库 + 反馈 | 本地 JSON 兜底；关闭反馈和 AI |
| Gemini API 超时（v1.1） | 未匹配项 | 标记 unmatched，不影响已匹配项 |
| Vercel 部署失败 | 全站 | 回滚上一版本 |

### 监控（Sentry 免费层）
- OCR 失败率（目标 < 5%）
- 规则库命中率（目标 > 70%）
- Haiku 调用成功率（目标 > 95%）
- 页面错误率（目标 < 1%）

---

## 十一、安全架构

### Alpha 上线阻断项（8 项）

| # | 项目 | 说明 |
|---|------|------|
| 1 | OCR Spike 通过 | 至少一个引擎在桌面 + 移动可用 |
| 2 | iOS Safari OCR 可用 | Tesseract.js 在 iPhone 正常运行 |
| 3 | Demo 模式可用 | 不上传也能看到价值 |
| 4 | プライバシーポリシー | 日文 PIPA 合规隐私政策 |
| 5 | HTTPS + HSTS | 强制 HTTPS（Vercel 默认 + next.config.js） |
| 6 | CSP 安全头 | Content-Security-Policy, X-Frame-Options, X-Content-Type-Options |
| 7 | Rate Limiting | 前端 10 次上传/时（localStorage 计数） |
| 8 | Sentry 接入 | 错误监控 + PII 清洗（scrubData: true） |

### v1.1 安全加固（不阻断 Alpha）

| 项目 | 说明 |
|------|------|
| Supabase RLS | deny by default |
| feedback_audit 审计表 | 反馈操作日志 |
| 反馈文本 SHA-256 hash 化 | 不存原始 OCR 文本 |
| 数据留存策略 | 90 天自动清除反馈数据 |
| Prompt sanitize | 去 JSON 特殊字符、限长 200 字符 |
| Haiku 响应 Zod 校验 | 防止幻觉输出 |
| IndexedDB 加密 | Dexie.js + crypto-js（共享设备保护） |

### 隐私优先定位（市场差异化）

> **「あなたのデータは、あなたのデバイスから出ません。」**
> （你的数据不离开你的设备）

- 竞品（サブスク管理、SubsHub）：手动录入，隐私风险低但功能弱
- Rocket Money：连接银行 API，功能强但隐私差
- **Subscription Doctor = 功能强（OCR + AI）+ 隐私强（本地处理）**

---

## 十二、关联文档

| 文档 | 位置 | 内容 |
|------|------|------|
| 技术逻辑与验证门 | `./TECHNICAL_LOGIC_AND_VALIDATION.md` | 模块逻辑链 + 验证点 |
| 最终执行计划 | `~/.claude/plans/tranquil-tumbling-meteor.md` | 精简版可执行计划 |
| 交接文档（前序） | `~/.claude/projects/.../HANDOFF_DOCUMENT.md` | 前序分析、决策记录 |

---

## 十三、用户旅程漏斗

```
认知 (Twitter/Qiita)     → 1,000 人看到
  ↓ 20% 点击
着陆页                    → 200 人访问
  ↓ 30% 试用（含 Demo 演示模式降低门槛）
首次上传                  → 60 人上传
  ↓ 80% OCR 成功（目标）
看到体检报告              → 48 人
  ↓ 50% 觉得有用（报告必须立刻展示浪费金额）
价值感知                  → 24 人留存
  ↓ 3% 付费（日本 utility app 基准）
Paid 用户                 → 0.7 人/千次曝光
```

**最大瓶颈：「看到报告 → 觉得有用」**
→ 报告第一屏必须显示：「あなたは年間 ¥X 余分に払っています」
→ 不能只列订阅清单

**分享卡片设计原则**：
- 只显示评分 + 节省金额（不显示具体服务名 → 降低日本用户分享心理门槛）
- 底部加「あなたも診断する → subsc-doctor.jp」+ 二维码

---

**本方案 v1.4 即日生效。下一步：更新技术文档 → 初始化项目 → W1 OCR Spike。**
