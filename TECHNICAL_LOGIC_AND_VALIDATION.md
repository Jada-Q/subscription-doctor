# Subscription Doctor — 技术逻辑链与验证门规范

**版本**: v1.4（最终执行版）

**原则：每个功能模块 = 逻辑链 + 验证门。验证门全部通过，才能开始下一个模块的开发。**

---

## 开发顺序总览（修正：分 MVP + v1.1 两阶段）

```
═══ W1：OCR Spike（Day 1-3，最高优先级风险消除）═══
测试 tesseract.js + client-side-ocr / paddleocr
  → 5-10 张真实日文账单（楽天/SMBC/JCB）
  → Mac Chrome + iPhone Safari
  → 选定引擎 → 更新本文档

═══ MVP（6 周）═══
模块1：图片输入与预处理（含 HEIC fork @tuily/heic2any）
  ↓ [Gate 1 通过]
模块2：OCR 文字识别 ★ 双引擎：桌面 PaddleOCR 系 / 移动 Tesseract.js
  ↓ [Gate 2 通过]
模块3：文字清洗与结构化 ★ 含发卡机构选择（楽天/SMBC/JCB 等专用解析）
  ↓ [Gate 3 通过]
模块4：规则库匹配引擎 ★ 本地 JSON 10 服务（不依赖 Supabase）
  ↓ [Gate 4 通过]
模块5：苹果税检测
  ↓ [Gate 5 通过]
模块6：重复订阅检测（简化版：仅 cloud_storage）
  ↓ [Gate 6 通过]
模块8：体检报告生成 + Demo 演示模式
  ↓ [Gate 8 通过]
安全加固（HTTPS/CSP/Rate Limit）+ 隐私政策 + Sentry + Landing → Alpha

※ 模块 7（敏感遮盖）从 MVP 移至 v1.1：数据完全本地处理，Alpha 不需要

═══ v1.1（Alpha 后 2-3 周）═══
模块7：敏感数据遮盖（卡号/姓名/地址）
  ↓ [Gate 7 通过]
模块9：用户修正与反馈循环（含独立数据同意）
  ↓ [Gate 9 通过]
模块10：本地历史存储（需 feature detect 隐私模式 IndexedDB）
  ↓ [Gate 10 通过]
模块11：AI Fallback（Gemini Flash-Lite 免费层，含 prompt sanitize + Zod 校验）
  ↓ [Gate 11 通过]
Supabase 迁移 + 安全加固（RLS/审计/hash）→ v1.1 上线
```

---

## 模块间 TypeScript 接口定义（审查新增）

```typescript
// 模块 1 输出 → 模块 2 输入
interface ImageInput {
  compressedBlob: Blob;
  metadata: {
    originalSize: number;
    compressedSize: number;
    width: number;
    height: number;
    format: 'jpg' | 'png' | 'heic';
    timestamp: string;
    // 审查新增：记录压缩比例，供模块 7 坐标换算
    scaleRatio: { x: number; y: number };
  };
}

// 模块 2 输出 → 模块 3 输入
interface OcrResult {
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: [number, number, number, number]; // x, y, width, height（基于压缩后图片）
  }>;
  engine: 'paddleocr' | 'tesseract';  // v1.4 新增：记录使用的 OCR 引擎
  avgConfidence: number;
  qualityLevel: 'high' | 'medium' | 'low';
  processingTimeMs: number;
}

// 模块 3 输出 → 模块 4 输入
interface StructuredTransaction {
  id: string;  // uuid
  date: string | null;  // ISO 8601, null if unparseable
  description: string;  // 已标准化：半角大写、去多余空格
  amount: number;       // 标准化后的数字
  rawText: string;
  lineConfidence: number;
  flags: ('high_amount' | 'duplicate_charge' | 'negative_amount')[];
}

// 模块 4 输出 → 模块 5/6/8 输入
interface MatchedTransaction extends StructuredTransaction {
  matchedRule: {
    id: string;
    service: string;
    plan: string;
    category: string;
    appStorePrice: number;
    officialPrice: number;
    priceCheckedDate: string;
    billingCycle: 'monthly' | 'annual' | 'unknown';  // v1.4 新增：避免年费×12 过度计算
    overlaps: string[];
  } | null;
  matchType: 'keyword_exact' | 'amount_assisted' | 'ai_assisted' | 'unmatched';
  matchConfidence: number;
  conflicts: string[];
}

// 模块 8 输出
interface Report {
  version: number;  // 审查新增：报告版本号（每次修正 +1）
  score: number;
  grade: 'green' | 'yellow' | 'red';
  summary: { totalSubscriptions: number; totalMonthlySpend: number; totalAnnualSpend: number };
  appleTax: { count: number; totalAnnualWaste: number; details: any[] };
  overlaps: { count: number; totalPotentialSaving: number; details: any[] };
  healthy: any[];
  unidentified: any[];
  generatedAt: string;
}
```

---

## 模块 1：图片输入与预处理

### 1.1 逻辑链

```
用户行为：选择/拖拽图片
  ↓
[L1.1] 文件类型检查
  → 允许：JPG, JPEG, PNG, HEIC (iPhone 默认)
  → 拒绝：PDF, GIF, BMP, 视频, 其他
  → 拒绝时：显示"対応フォーマット：JPG, PNG, HEIC"
  ↓
[L1.2] 文件大小检查
  → 允许：≤ 10MB
  → 拒绝：> 10MB → 显示"ファイルサイズは10MB以下にしてください"
  ↓
[L1.3] 图片尺寸读取
  → 使用 Image() 对象获取 width × height
  → 记录原始尺寸（后续 OCR 需要参考）
  ↓
[L1.4] HEIC → JPG 转换（仅 iPhone 用户）
  → 使用 @tuily/heic2any 库（原 heic2any 在 Safari 有 bug，使用修复版 fork）
  → 转换失败 → 提示"スクリーンショットを撮ってアップロードしてください"
  → UI 默认引导用户上传截图（PNG）而非拍照（HEIC）
  ↓
[L1.5] 图片压缩（Pica 库）
  → 目标：长边 ≤ 1500px，文件 ≤ 500KB
  → 压缩质量：0.85（平衡清晰度与速度）
  → 压缩比记录：original_size / compressed_size
  ↓
[L1.6] 图片内容预检（简易判断是否为账单类图片）
  → 检查方式：压缩后图片送入 OCR → 看是否包含数字 + 日文/英文
  → 如果 OCR 输出 < 10 个字符 → 警告"画像が不鮮明です。もう一度お試しください"
  → 如果 OCR 输出不含任何数字 → 警告"請求書・明細書の画像をアップロードしてください"
  ↓
输出：ImageInput {
  compressedBlob,
  metadata: { originalSize, compressedSize, width, height, format, timestamp, scaleRatio }
}
  ※ scaleRatio = 原始尺寸/压缩尺寸，供模块 7 坐标换算
```

### 1.2 验证门 (Gate 1)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G1.1 | JPG 正常上传 | 标准信用卡账单 JPG | 压缩成功，进入 OCR | ✅ |
| G1.2 | PNG 正常上传 | App Store 邮件截图 PNG | 压缩成功，进入 OCR | ✅ |
| G1.3 | HEIC 转换 | iPhone 拍照 HEIC | 转为 JPG 后压缩成功 | ✅ |
| G1.4 | 拒绝 PDF | test.pdf | 显示格式不支持提示 | ✅ |
| G1.5 | 拒绝视频 | test.mp4 | 显示格式不支持提示 | ✅ |
| G1.6 | 超大文件 | 15MB 的 PNG | 显示文件过大提示 | ✅ |
| G1.7 | 极小/空文件 | 0KB 文件 | 显示文件无效提示 | ✅ |
| G1.8 | 模糊图片 | 故意拍糊的照片 | OCR < 10字符时显示警告 | ✅ |
| G1.9 | 非账单图片 | 猫的照片 | 无数字时显示"请上传账单"警告 | ✅ |
| G1.10 | 压缩质量 | 4000×3000 高清截图 | 压缩后 ≤ 500KB 且文字仍可读 | ✅ |

**Gate 1 通过条件：10/10 测试全部通过**

---

## 模块 2：OCR 文字识别

### 2.1 逻辑链

```
输入：compressed_image_blob（来自模块 1）
  ↓
[L2.0] ★ 引擎选择（v1.4 新增：双引擎架构）
  → 检测 navigator.userAgent
  → iPhone/iPad（iOS Safari）→ 使用 Tesseract.js（ONNX Runtime 在 iOS 崩溃）
  → 其他浏览器 → 尝试 PaddleOCR 系引擎 → 失败则 fallback 到 Tesseract.js
  → 记录使用的引擎到 OcrResult.engine 字段
  ↓
[L2.1] 加载 OCR 模型
  → PaddleOCR 系：首次下载模型文件（约 10-15MB），后续从缓存读取
  → Tesseract.js：首次下载 jpn.traineddata（约 15MB），后续从缓存读取
  → 加载超时（>15秒）→ 显示进度条 + "モデル読み込み中..."
  → PaddleOCR 加载失败 → 自动切换 Tesseract.js（桌面端）
  → Tesseract.js 加载失败 → 重试 1 次 → 仍失败 → 提示"ブラウザを更新してください"
  ↓
[L2.2] 执行 OCR
  → 传入 compressed_image_blob
  → 返回：[{ text: "APPLE COM BILL", confidence: 0.92, bbox: [x,y,w,h] }, ...]
  → 每个识别块包含：文字内容 + 置信度 + 在图片中的位置坐标
  ↓
[L2.3] OCR 结果质量评估
  → 计算整体置信度：所有块的 confidence 加权平均
  → 高质量：平均 confidence ≥ 0.80 → 直接进入下一步
  → 中质量：0.60 ≤ confidence < 0.80 → 标记"識別精度が低い箇所があります"
  → 低质量：confidence < 0.60 → 建议重新上传更清晰的图片
  ↓
[L2.4] 耗时记录
  → 记录 OCR 执行时间（毫秒）
  → 目标：桌面 < 3000ms / 移动 < 6000ms
  → 首次加载时间（含模型下载）单独计时，不计入 OCR 性能
  → 超过 10000ms → 记录为性能异常（发送到 Sentry）
  ↓
输出：ocr_result {
  blocks: [{ text, confidence, bbox }],
  engine: "paddleocr" | "tesseract",
  avgConfidence: number,
  qualityLevel: "high" | "medium" | "low",
  processingTimeMs: number
}
```

### 2.2 验证门 (Gate 2)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G2.1 | 日文账单识别 | 日本信用卡明细截图 | 正确识别日文服务名 + 金额 | 准度 ≥ 85% |
| G2.2 | 英文条目识别 | "APPLE COM BILL 1500" | 正确识别英文 + 数字 | 准度 ≥ 90% |
| G2.3 | 混合语言 | 日英混合账单 | 两种语言都能识别 | 准度 ≥ 80% |
| G2.4 | 多行识别 | 10行以上的账单 | 所有行都被识别 | 漏识率 < 10% |
| G2.5 | 置信度准确性 | 清晰 vs 模糊图片各1张 | 清晰图 conf > 0.85, 模糊图 conf < 0.70 | ✅ |
| G2.6 | 处理速度（桌面） | 标准 500KB 账单图片 on Chrome | < 3000ms | ✅ |
| G2.6b | 处理速度（移动） | 同上 on iOS Safari | < 6000ms | ✅ |
| G2.7 | 模型缓存 | 第二次加载 | 无需重新下载模型 | 加载 < 1秒 |
| G2.8 | 数字识别精度 | 含 ¥1,500 / ¥980 / ¥2,728 | 金额数字 100% 正确 | ✅ |
| G2.9 | 特殊字符 | 含 ¥、/、- 等符号 | 不丢失、不误读 | ✅ |
| G2.10 | 浏览器兼容 | Chrome / Safari / Firefox / Edge / iOS Safari | 5 个浏览器都能执行 OCR | ✅ |
| G2.11 | 隐私模式 | Chrome 隐私模式 | OCR 正常运行（不依赖 IndexedDB） | ✅ |
| G2.12 | 内存释放 | 连续上传 5 张图片 | 前一张的 ObjectURL 已 revoke，无内存泄漏 | ✅ |
| G2.13 | ★ 双引擎切换 | iOS Safari 上传图片 | 自动选择 Tesseract.js 而非 PaddleOCR | ✅ |
| G2.14 | ★ PaddleOCR fallback | 桌面 Chrome 模拟 PaddleOCR 加载失败 | 自动降级到 Tesseract.js | ✅ |
| G2.15 | ★ 引擎记录 | 任意上传 | OcrResult.engine 正确记录使用的引擎 | ✅ |

**Gate 2 通过条件：15/15 全部通过，其中 G2.8（金额识别）、G2.13（双引擎切换）为硬性必过项**

---

## 模块 3：文字清洗与结构化

### 3.1 逻辑链

```
输入：ocr_result.blocks（来自模块 2）+ 用户选择的发卡机构
  ↓
[L3.0] ★ 发卡机构选择（v1.4 新增）
  → UI 提供「カード会社を選択」下拉框：
    - 楽天カード / SMBC / JCB / MUFG / AMEX / Orico / その他
  → 根据选择加载对应的解析规则（列顺序、日期格式、特殊标记）
  → 「その他」使用通用解析规则
  → 发卡机构信息记录到结果中（用于后续优化解析精度）
  ↓
[L3.1] 原始文本拼接
  → 将所有 blocks 按 bbox 的 y 坐标排序（从上到下）
  → 同一行（y 坐标差 < 阈值）的 blocks 按 x 坐标排序（从左到右）
  → 拼接为逻辑行：["2024/12/01  APPLE COM BILL  1,500", "2024/12/03  NETFLIX  990", ...]
  ↓
[L3.2] 行级分类（使用发卡机构专用规则）
  → 每一行判断类型：
    - "transaction"（交易行）：包含日期模式 + 金额模式
    - "header"（表头）：包含"日付"、"摘要"、"金額"等关键词
    - "noise"（噪音）：页码、银行名、地址等非交易信息
  → 分类依据：
    - 日期正则：/\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/ 或 /\d{1,2}月\d{1,2}日/
    - 金额正则：/[¥￥]?\s?[\d,]+(\.\d{2})?/ 或 /\d{1,3}(,\d{3})*/
  ↓
[L3.3] 交易行解析
  → 从 "transaction" 类型的行中提取：
    {
      date: "2024-12-01",        // 标准化日期
      description: "APPLE COM BILL",  // 服务描述
      amount: 1500,              // 数字化金额（去除逗号、¥符号）
      rawText: "原始识别文字",    // 保留原文用于调试
      lineConfidence: 0.91       // 该行的平均置信度
    }
  ↓
[L3.4] 金额标准化
  → "1,500" → 1500
  → "¥ 980" → 980
  → "￥2,728" → 2728
  → "1500円" → 1500
  → 负数处理："-1,500" 或 "(1,500)" → -1500（退款）
  ↓
[L3.4b] 文字标准化（审查新增：集中到模块 3，模块 4 不再重复）
  → 全角英数 → 半角（ＡＰＰＬＥ → APPLE）
  → 转大写（apple → APPLE）
  → 去除多余空格（"APPLE  COM" → "APPLE COM"）
  → 全角符号 → 半角（￥ → ¥, （ → (, ） → )）
  ↓
[L3.4c] 日期合理性验证（审查新增）
  → 解析后的日期必须：year ≥ 2020 AND year ≤ currentYear + 1
  → 月份 1-12，日 1-31
  → 无效日期（如 2026/13/45）→ date 置为 null，不阻断流程
  ↓
[L3.5] 去重
  → 检查是否有完全相同的 (date + amount + description) → 合并
  → 检查是否有同一服务同月多次出现 → 标记为"多重扣款疑似"
  ↓
[L3.6] 结构化验证
  → 检查：提取到的交易条目数 ≥ 1
  → 检查：每条交易都有 amount（必须）+ description（必须）
  → 检查：金额范围合理性 — 单笔 > ¥100,000 → 标记为"高额，请确认"
  → 如果提取到 0 条交易 → 返回错误"取引明細を検出できませんでした"
  ↓
输出：structured_transactions [
  { date, description, amount, rawText, lineConfidence, flags[] }
]
```

### 3.2 验证门 (Gate 3)

| 测试编号 | 测试内容 | 输入（OCR 原始文本） | 期望输出 | 通过标准 |
|----------|---------|---------------------|----------|---------|
| G3.1 | 标准日本信用卡格式 | "12/01 APPLE COM BILL 1,500" | date:"2024-12-01", desc:"APPLE COM BILL", amount:1500 | ✅ |
| G3.2 | 日文日期格式 | "12月1日 アマゾンプライム 600" | 正确解析日期 + 金额 | ✅ |
| G3.3 | 多行解析 | 5行不同交易 | 提取出 5 条交易记录 | ✅ |
| G3.4 | 金额格式变体 | "¥1,500" / "980円" / "￥2728" / "1,500" | 全部标准化为数字 | ✅ |
| G3.5 | 噪音过滤 | 含银行名、地址、页码的完整账单 | 仅提取交易行，噪音被过滤 | ✅ |
| G3.6 | 表头识别 | 含"日付 / 摘要 / 金額"表头 | 表头不被误识为交易 | ✅ |
| G3.7 | 退款识别 | "-1,500" 或 "(1,500)" | amount: -1500 | ✅ |
| G3.8 | 重复行去重 | 同一交易出现两次 | 合并为 1 条 | ✅ |
| G3.9 | 高额警告 | 单笔 150,000 | flags 包含 "high_amount" | ✅ |
| G3.10 | 零交易处理 | OCR 输出全是噪音 | 返回错误提示，不崩溃 | ✅ |
| G3.11 | 多重扣款检测 | 同服务同月出现 2 次 | flags 包含 "duplicate_charge" | ✅ |
| G3.12 | 全角→半角标准化 | "ＡＰＰＬＥ　ＣＯＭ" | "APPLE COM" | ✅ |
| G3.13 | 无效日期处理 | "2026/13/45" | date: null（不崩溃） | ✅ |
| G3.14 | 过去日期验证 | "1990/01/01" | date: null（超出合理范围） | ✅ |

**Gate 3 通过条件：14/14 全部通过，其中 G3.4（金额标准化）为硬性必过项**

---

## 模块 4：规则库匹配引擎

### 4.1 逻辑链

```
输入：structured_transactions（来自模块 3）
  ↓
[L4.1] 加载规则库
  → 从 rules.json 加载（或从 Supabase 远程拉取 + 本地缓存）
  → 规则库结构：
    {
      id: "apple_icloud_2tb",
      keywords: ["APPLE COM BILL", "APPLE.COM/BILL", "APPLE COM"],
      amountHints: [130, 400, 1500],  // 各套餐金额
      service: "Apple iCloud",
      plans: [
        { name: "50GB", appStorePrice: 130, officialPrice: 130 },
        { name: "200GB", appStorePrice: 400, officialPrice: 400 },
        { name: "2TB", appStorePrice: 1500, officialPrice: 1300 }
      ],
      category: "cloud_storage",
      overlaps: ["google_one_2tb", "onedrive_1tb"]
    }
  ↓
[L4.2] 关键词匹配（第一轮：精确匹配）
  → description 已在模块 3 完成标准化（半角大写去空格），此处直接使用
  → 与规则库每条规则的 keywords 做包含匹配
  → 匹配成功 → 记录 matchType: "keyword_exact"
  ↓
[L4.3] 金额辅助匹配（第二轮：模糊匹配）
  → 对第一轮未匹配的交易：
    - 用 amount 在所有规则的 amountHints 中查找
    - 金额匹配（允许 ±5% 误差，考虑汇率浮动）
    - 如果金额命中 + description 包含部分关键词 → matchType: "amount_assisted"
  ↓
[L4.4] 匹配置信度计算
  → keyword_exact + amount 命中 → confidence: 0.95
  → keyword_exact 但 amount 不在 hints 中 → confidence: 0.80
  → amount_assisted 仅金额命中 → confidence: 0.50
  → 完全未匹配 → confidence: 0.00, matchType: "unmatched"
  ↓
[L4.5] 套餐识别
  → 匹配到服务后，根据 amount 确定具体套餐：
    - amount == 1500 → "iCloud 2TB"
    - amount == 400 → "iCloud 200GB"
  → 允许 ±5% 模糊匹配（应对税率变化）
  ↓
[L4.6] 匹配冲突解决
  → 如果一条交易同时匹配到多个规则：
    - 优先选择 keyword_exact 的
    - 如果都是 keyword_exact → 选择 amountHints 也命中的
    - 如果仍冲突 → 标记为 "conflict"，交给用户确认
  ↓
[L4.7] 规则库版本检查
  → 记录规则库最后更新日期
  → 如果 > 30 天未更新 → 在结果页显示"ルールデータが古い可能性があります"
  ↓
输出：MatchedTransaction[] （见 TypeScript 接口定义）
  注意：matchedRule 包含 appStorePrice / officialPrice / priceCheckedDate（审查修复）
```

### 4.2 验证门 (Gate 4)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G4.1 | 精确匹配 Apple | desc:"APPLE COM BILL", amount:1500 | service:"Apple iCloud", plan:"2TB" | ✅ |
| G4.2 | 精确匹配 Netflix | desc:"NETFLIX", amount:990 | service:"Netflix", plan:"広告つきスタンダード" | ✅ |
| G4.3 | 精确匹配 Spotify | desc:"SPOTIFY", amount:980 | service:"Spotify Premium" | ✅ |
| G4.4 | 金额辅助匹配 | desc:"COM BILL", amount:1500 | amount_assisted, confidence ≤ 0.50 | ✅ |
| G4.5 | 未匹配处理 | desc:"ABCXYZ", amount:777 | matchType:"unmatched" | ✅ |
| G4.6 | 套餐识别 iCloud 50GB | desc:"APPLE COM BILL", amount:130 | plan:"50GB" | ✅ |
| G4.7 | 套餐识别 iCloud 200GB | desc:"APPLE COM BILL", amount:400 | plan:"200GB" | ✅ |
| G4.8 | 金额模糊容差 | amount:1485 (= 1500的99%) | 仍匹配到 iCloud 2TB | ✅ |
| G4.9 | 冲突解决 | 一条交易命中2个规则 | 选择更精确的，或标记 conflict | ✅ |
| G4.10 | 全角已在模块3标准化 | desc 已是半角大写 | 直接匹配成功 | ✅ |
| G4.11 | 规则库过期警告 | lastUpdated > 30天前 | 显示警告信息 | ✅ |
| G4.12 | 空规则库降级 | rules.json 加载失败（Supabase 不可用） | 本地 JSON 兜底，不崩溃 | ✅ |
| G4.13 | Top 30 服务覆盖 | 30 个已知服务各 1 条 | 全部正确匹配 | 命中率 100% |
| G4.14 | APPLE 关键词歧义 | desc:"APPLE COM BILL" amount:980 | 匹配 Apple Music（非 iCloud），因金额辅助 | ✅ |
| G4.15 | GOOGLE 关键词歧义 | desc:"GOOGLE" amount:1300 | 匹配 Google One 2TB（非 Google Play） | ✅ |
| G4.16 | 价格字段完整性 | 任意匹配结果 | matchedRule 包含 appStorePrice + officialPrice + priceCheckedDate | ✅ |

**Gate 4 通过条件：16/16 全部通过，其中 G4.13（Top 30 覆盖率）为硬性必过项**

---

## 模块 5：苹果税检测

### 5.1 逻辑链

```
输入：matched_transactions（来自模块 4，仅 matchType != "unmatched" 的）
  ↓
[L5.1] 筛选有苹果税数据的服务
  → 遍历 matched_transactions
  → 对每个匹配到的 plan：检查是否存在 appStorePrice != officialPrice
  → 如果 appStorePrice > officialPrice → 标记为 appleTaxDetected: true
  ↓
[L5.2] 差额计算
  → delta = appStorePrice - officialPrice
  → deltaPercent = (delta / officialPrice) * 100
  → annualDelta = delta * 12（月付）或 delta * 1（年付）
  → 示例：iCloud 2TB → delta: 200, deltaPercent: 15.4%, annualDelta: 2400
  ↓
[L5.3] 苹果税合理性检查
  → deltaPercent > 50% → 标记为 "price_data_suspect"（价格数据可能过期）
  → deltaPercent == 0 → 无苹果税，不标记
  → 0 < deltaPercent ≤ 50% → 正常苹果税范围
  ↓
[L5.4] 价格数据时效性检查
  → 每个 plan 的价格数据附带 priceCheckedDate
  → 如果 > 60 天未更新 → 在结果中注明"※ 価格情報は {date} 時点のものです"
  ↓
[L5.5] 汇总
  → totalAppleTaxMonthly = 所有检出服务的月度 delta 之和
  → totalAppleTaxAnnual = totalAppleTaxMonthly * 12
  ↓
输出：apple_tax_report {
  detectedServices: [
    {
      service, plan,
      appStorePrice, officialPrice,
      delta, deltaPercent, annualDelta,
      priceCheckedDate,
      flags: ["price_data_suspect"] | []
    }
  ],
  totalMonthly: number,
  totalAnnual: number
}
```

### 5.2 验证门 (Gate 5)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G5.1 | iCloud 2TB 苹果税 | appStorePrice:1500, officialPrice:1300 | delta:200, percent:15.4% | ✅ |
| G5.2 | 无苹果税服务 | appStorePrice == officialPrice | appleTaxDetected: false | ✅ |
| G5.3 | 年度汇总计算 | 2 个服务各 delta 200 | totalAnnual: 4800 | ✅ |
| G5.4 | 异常差价检测 | deltaPercent > 50% | flags 包含 "price_data_suspect" | ✅ |
| G5.5 | 价格过期标注 | priceCheckedDate > 60天前 | 结果附注日期 | ✅ |
| G5.6 | 零苹果税场景 | 所有服务 delta == 0 | 不显示苹果税模块 | ✅ |
| G5.7 | 负差价处理 | officialPrice > appStorePrice | 不标记为苹果税（可能是促销） | ✅ |

**Gate 5 通过条件：7/7 全部通过**

---

## 模块 6：重复订阅检测

### 6.1 逻辑链

```
输入：matched_transactions（来自模块 4）
  ↓
[L6.1] 加载重叠关系表
  → 预定义的功能重叠矩阵：
    overlap_groups: {
      "cloud_storage": ["apple_icloud_*", "google_one_*", "onedrive_*", "dropbox_*"],
      "music_streaming": ["spotify", "apple_music", "youtube_music", "amazon_music"],
      "video_streaming": ["netflix", "amazon_prime_video", "disney_plus", "hulu_jp"],
      "ai_assistant": ["chatgpt_plus", "claude_pro", "gemini_advanced"]
    }
  ↓
[L6.2] 检测同组重叠
  → 对用户的 matched_transactions：
    - 按 category 分组
    - 在同一 overlap_group 中出现 2+ 个服务 → 标记 overlap
  → 示例：iCloud 2TB + Google One 2TB → "cloud_storage" 组重叠
  ↓
[L6.3] 重叠严重度评估
  → 同类型、同容量/同层级 → severity: "high"
    （例：iCloud 2TB + Google One 2TB → 高度重叠）
  → 同类型、不同层级 → severity: "medium"
    （例：iCloud 50GB + Google One 2TB → 中度，可能一个做备份）
  → 不同类型但功能接近 → severity: "low"
    （例：Netflix + Disney+ → 低度，内容不同但类型相同）
  ↓
[L6.4] 误报过滤规则
  → 已知合理的多订阅场景不标记：
    - Netflix + Amazon Prime（Prime 不仅是视频）
    - iCloud 50GB（照片）+ Google One 2TB（全平台备份）→ 容量差距大，可能互补
  → 过滤规则存储在 overlap_exceptions.json 中
  ↓
[L6.5] 节省建议生成
  → 如果 severity == "high"：
    - 计算保留较便宜的那个 vs 当前总支出的差额
    - "iCloud 2TB (¥1,500) と Google One 2TB (¥1,300) が重複しています。
       Google One に統合すると月 ¥1,500 節約できます。"
  → 如果 severity == "medium" / "low"：
    - 仅提示，不强推取消
    - "ご確認ください：同じカテゴリのサービスが複数あります"
  ↓
输出：overlap_report {
  overlaps: [
    {
      group: "cloud_storage",
      services: [serviceA, serviceB],
      severity: "high" | "medium" | "low",
      monthlySavingIfConsolidate: 1500,
      suggestion: "..."
    }
  ],
  totalPotentialSaving: number
}
```

### 6.2 验证门 (Gate 6)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G6.1 | 高度重叠 | iCloud 2TB + Google One 2TB | severity:"high", saving:1500 | ✅ |
| G6.2 | 中度重叠 | iCloud 50GB + Google One 2TB | severity:"medium" | ✅ |
| G6.3 | 低度重叠 | Netflix + Disney+ | severity:"low" | ✅ |
| G6.4 | 无重叠 | Netflix + Spotify | 无 overlap 检出 | ✅ |
| G6.5 | 误报过滤 | Netflix + Amazon Prime | 不标记为重叠（Prime 是综合服务） | ✅ |
| G6.6 | 3 个服务同组 | iCloud + Google One + Dropbox | 检出，列出全部 3 个 | ✅ |
| G6.7 | 节省建议准确 | 2 个服务重叠 | 建议保留更便宜的，金额正确 | ✅ |
| G6.8 | 跨组不误报 | Spotify (音乐) + Netflix (视频) | 不同组，不标记 | ✅ |

**Gate 6 通过条件：8/8 全部通过，其中 G6.5（误报过滤）为硬性必过项**

---

## 模块 7：敏感数据遮盖

### 7.1 逻辑链

```
输入：ocr_result.blocks（来自模块 2，含 bbox 坐标）
  ↓
[L7.1] 敏感信息模式识别
  → 信用卡号：/\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/
  → 银行账号：/\d{7,}/ （7位以上连续数字，排除金额和日期）
  → 姓名区域：通常在账单顶部，含日文汉字 2-4 字符 + "様"
  → 地址：含"都""道""府""県""市""区""町""村"的文本块
  → 电话号码：/0\d{1,4}[\-]?\d{1,4}[\-]?\d{3,4}/
  ↓
[L7.2] 区分「敏感」vs「需要的数据」
  → 需要保留的：服务名、金额、日期
  → 需要遮盖的：卡号、姓名、地址、电话
  → 决策逻辑：
    - 如果一个文本块同时包含敏感信息和金额 → 仅遮盖敏感部分
    - 如果整个块都是敏感信息 → 整块遮盖
  ↓
[L7.3] 遮盖执行
  → 在 canvas 上对原始图片（用于预览时）：
    - 用白色/灰色矩形覆盖敏感区域 bbox
  → 在文本数据中：
    - 卡号："**** **** **** 1234"（仅保留后 4 位）
    - 姓名："***様"
    - 地址："東京都***"
    - 电话："***-****-1234"
  ↓
[L7.4] 遮盖完整性验证（自检）
  → 遮盖后重新对遮盖区域做 OCR
  → 如果仍能识别出数字序列 ≥ 8 位 → 遮盖失败 → 扩大遮盖范围重试
  → 最多重试 2 次
  ↓
[L7.5] 原始数据清除
  → 遮盖完成后，从内存中删除原始 image_blob
  → 仅保留遮盖后的预览图 + 结构化文本数据
  → 确认：original_blob 引用为 null
  ↓
输出：{
  maskedPreviewImage: blob,    // 遮盖后的预览图（可选显示给用户）
  maskedTextData: [...],       // 文本中敏感部分已替换
  maskingReport: {
    totalSensitiveAreas: number,
    maskedAreas: number,
    verificationPassed: boolean
  }
}
```

### 7.2 验证门 (Gate 7)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G7.1 | 信用卡号遮盖 | "4532 1234 5678 9012" | "**** **** **** 9012" | ✅ |
| G7.2 | 日文姓名遮盖 | "田中太郎 様" | "***様" | ✅ |
| G7.3 | 地址遮盖 | "東京都渋谷区..." | "東京都***" | ✅ |
| G7.4 | 电话遮盖 | "03-1234-5678" | "***-****-5678" | ✅ |
| G7.5 | 金额不被遮盖 | "1,500" 在非敏感区域 | 保留原文 | ✅ |
| G7.6 | 服务名不被遮盖 | "APPLE COM BILL" | 保留原文 | ✅ |
| G7.7 | 混合块处理 | 一行含卡号 + 金额 | 仅遮盖卡号部分 | ✅ |
| G7.8 | 遮盖自检 | 遮盖后重新 OCR | 无法识别出原始敏感信息 | ✅ |
| G7.9 | 原始数据清除 | 遮盖完成后 | original_blob == null | ✅ |
| G7.10 | 无敏感信息场景 | 仅含服务名+金额的截图 | maskingReport.totalSensitiveAreas == 0，不崩溃 | ✅ |

**Gate 7 通过条件：10/10 全部通过，其中 G7.8（遮盖自检）和 G7.9（数据清除）为硬性必过项**

---

## 模块 8：体检报告生成

### 8.1 逻辑链

```
输入：
  - matched_transactions（模块 4）
  - apple_tax_report（模块 5）
  - overlap_report（模块 6）
  - maskingReport（模块 7）
  ↓
[L8.1] 数据汇总
  → totalSubscriptions = matched + unmatched 总数
  → totalMonthlySpend = 所有交易 amount 之和
  → totalAnnualSpend = totalMonthlySpend * 12
  → identifiedServices = matchType != "unmatched" 的数量
  → unidentifiedServices = matchType == "unmatched" 的数量
  ↓
[L8.2] 健康评分计算
  → 基础分：100
  → 扣分规则：
    - 每检出 1 个苹果税服务：-10
    - 每检出 1 组高度重叠：-15
    - 每检出 1 组中度重叠：-5
    - unmatched 占比 > 30%：-10（说明很多未知支出）
  → 最低分：0
  → 评级：
    - 90-100：🟢 健康（"サブスク管理が優秀です！"）
    - 70-89：🟡 注意（"改善の余地があります"）
    - 0-69：🔴 要改善（"すぐに見直しをおすすめします"）
  ↓
[L8.3] 金额一致性校验
  → 检查：所有明细的 amount 之和 == totalMonthlySpend
  → 检查：appleTax.totalMonthly ≤ totalMonthlySpend（苹果税不能超过总支出）
  → 检查：overlap 建议节省金额 ≤ overlap 涉及服务的总金额
  → 如果不一致 → 记录错误日志，在报告中不显示汇总金额（降级处理）
  ↓
[L8.4] 报告结构生成
  → report = {
      score: 72,
      grade: "yellow",
      summary: {
        totalSubscriptions: 8,
        totalMonthlySpend: 7500,
        totalAnnualSpend: 90000
      },
      appleTax: {
        count: 1,
        totalAnnualWaste: 2400,
        details: [...]
      },
      overlaps: {
        count: 1,
        totalPotentialSaving: 18000,
        details: [...]
      },
      healthy: [
        { service: "Netflix", amount: 990, status: "green" }
      ],
      unidentified: [
        { description: "UNKNOWN SERVICE", amount: 500 }
      ],
      generatedAt: "2026-03-23T14:30:00+09:00"
    }
  ↓
[L8.5] 分享卡片生成
  → 使用 html2canvas 或 canvas API 生成图片
  → 卡片内容：健康评分 + 苹果税总额 + 可节省金额 + 网站链接
  → 尺寸：1200×630（Twitter/OGP 最佳比例）
  → 不包含任何个人信息（仅统计数据）
  ↓
[L8.6] 分享安全检查
  → 确认卡片图片中不含：姓名、卡号、具体服务明细
  → 仅含：统计数字、评分、网站 URL
  ↓
输出：{
  report: ReportObject,
  shareCard: image_blob,
  shareCardSafe: boolean  // 安全检查通过
}
```

### 8.2 验证门 (Gate 8)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G8.1 | 完美账单 | 5 个已知服务，无苹果税，无重叠 | score: 100, grade:"green" | ✅ |
| G8.2 | 问题账单 | 2 个苹果税 + 1 组高度重叠 | score: 65, grade:"red" | ✅ |
| G8.3 | 金额一致性 | 明细之和 vs 汇总 | 完全一致 | ✅ |
| G8.4 | 苹果税不超支出 | appleTax.total vs totalSpend | appleTax ≤ total | ✅ |
| G8.5 | 空账单 | 0 条交易（边界情况） | 显示"検出なし"，不崩溃 | ✅ |
| G8.6 | 分享卡片尺寸 | 生成的图片 | 1200×630 | ✅ |
| G8.7 | 分享卡片无隐私 | 卡片 OCR 检查 | 不含任何个人信息 | ✅ |
| G8.8 | 金额不一致降级 | 故意让明细和不一致 | 不显示汇总，记录错误日志 | ✅ |

**Gate 8 通过条件：8/8 全部通过，其中 G8.3（金额一致性）和 G8.7（隐私安全）为硬性必过项**

---

## 模块 9：用户修正与反馈循环

### 9.1 逻辑链

```
输入：report + matched_transactions（显示在 UI 上）
  ↓
[L9.1] 修正入口
  → 每条交易旁显示 [✏️ 修正] 按钮
  → 点击后展开编辑面板：
    - 服务名（下拉选择已知服务 / 手动输入）
    - 金额（可修正 OCR 识别错误）
    - 类型（订阅 / 一次性支出 / 退款）
    - "这不是订阅"（排除按钮）
  ↓
[L9.2] 修正数据记录
  → correction = {
      transactionId,
      originalMatch: { service, amount, matchType },
      userCorrection: { service, amount, type },
      correctionType: "wrong_service" | "wrong_amount" | "not_subscription" | "new_service",
      timestamp
    }
  ↓
[L9.3] 本地即时生效（审查新增：版本控制）
  → report.version += 1（每次修正递增）
  → 人工修正始终优先于 AI 结果（如 Haiku 同时在处理同一条交易）
  → 修正后立即重新计算：
    - 苹果税报告（可能增减）
    - 重叠检测（可能增减）
    - 健康评分
    - 分享卡片
  → UI 实时更新，无需重新上传
  ↓
[L9.4] 反馈上报（用户同意时）
  → 弹窗询问"この修正を匿名でフィードバックしてもよろしいですか？"
  → 用户同意 → 发送到 Supabase：
    - 仅发送：original OCR text + original match + user correction
    - 不发送：金额、日期、任何个人信息
  → 用户拒绝 → 仅本地生效，不上报
  ↓
[L9.5] 规则库改进（后端批处理）
  → 当同一修正被 3+ 个用户提交 → 自动标记为"候选规则"
  → 管理员审核后加入规则库
  → 版本号递增
  ↓
输出：{
  corrections: [CorrectionObject],
  reportUpdated: boolean,
  feedbackSent: boolean
}
```

### 9.2 验证门 (Gate 9)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G9.1 | 修正服务名 | 将 unmatched 改为 "Netflix" | 报告实时更新，Netflix 出现在列表中 | ✅ |
| G9.2 | 修正金额 | 1500 → 1300 | 苹果税重新计算 | ✅ |
| G9.3 | 排除非订阅 | 标记"这不是订阅" | 从报告中移除，总额更新 | ✅ |
| G9.4 | 修正后评分更新 | 修正后消除了一个苹果税 | 评分上升 | ✅ |
| G9.5 | 反馈上报同意 | 用户点击"同意" | 数据发送到 Supabase | ✅ |
| G9.6 | 反馈上报拒绝 | 用户点击"拒绝" | 不发送，仅本地生效 | ✅ |
| G9.7 | 反馈不含隐私 | 检查上报数据 | 不含金额、日期、个人信息 | ✅ |
| G9.8 | 多次修正 | 连续修正 3 条 | 每次修正后报告正确更新 | ✅ |

**Gate 9 通过条件：8/8 全部通过，其中 G9.7（隐私保护）为硬性必过项**

---

## 模块 10：本地历史存储

### 10.1 逻辑链

```
输入：report（来自模块 8，含用户修正后的版本）
  ↓
[L10.1] 存储到 IndexedDB
  → 数据库名：subscription_doctor_db
  → 对象仓库：audit_history
  → 存储内容：
    {
      id: uuid,
      date: "2026-03-23",
      report: { ... },  // 完整报告（不含原始截图）
      corrections: [...],
      metadata: { imageSize, ocrTime, matchRate }
    }
  → 不存储：原始截图、遮盖前的文本
  ↓
[L10.2] 月度对比
  → 如果存在上个月的记录：
    - 新增订阅：本月有但上月没有的服务
    - 消失订阅：上月有但本月没有的服务
    - 价格变化：同一服务金额不同
  → 显示在报告底部："先月との比較"
  ↓
[L10.3] 存储容量管理
  → 最多保留 12 个月的记录
  → 超过 12 个月 → 自动删除最旧的
  → 总存储 < 5MB（仅文本数据）
  ↓
[L10.4] 数据导出
  → 提供"CSVダウンロード"按钮
  → 导出内容：日期、服务名、金额、类别
  → 不导出：OCR 原始文本、置信度等技术数据
  ↓
[L10.5] 一键清除
  → "すべてのデータを削除"按钮
  → 二次确认弹窗
  → 确认后清除 IndexedDB 全部数据
  → 清除后验证：indexedDB.databases() 确认为空
  ↓
输出：{
  stored: boolean,
  historyCount: number,
  comparison: { added: [], removed: [], priceChanged: [] } | null
}
```

### 10.2 验证门 (Gate 10)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G10.1 | 首次存储 | 第一份报告 | 成功写入 IndexedDB | ✅ |
| G10.2 | 历史读取 | 已有 1 份报告 | 正确读取并显示 | ✅ |
| G10.3 | 月度对比-新增 | 本月多了 Netflix | comparison.added 含 Netflix | ✅ |
| G10.4 | 月度对比-消失 | 本月少了 Spotify | comparison.removed 含 Spotify | ✅ |
| G10.5 | 月度对比-涨价 | Netflix 990→1490 | comparison.priceChanged 含 Netflix | ✅ |
| G10.6 | 12个月上限 | 存入第 13 条 | 最旧的被删除，保留 12 条 | ✅ |
| G10.7 | CSV 导出 | 3 个月数据 | 下载的 CSV 格式正确、可用 Excel 打开 | ✅ |
| G10.8 | 一键清除 | 点击删除 | IndexedDB 完全为空 | ✅ |
| G10.9 | 不存储截图 | 检查 IndexedDB | 无 image blob 类型数据 | ✅ |

**Gate 10 通过条件：9/9 全部通过**

---

## 模块 11：AI Fallback（Gemini Flash-Lite）— v1.1

### 11.1 逻辑链

```
输入：unmatched_transactions（来自模块 4，matchConfidence < 0.70 的交易）
  ↓
[L11.1] Fallback 触发条件
  → 仅当：matchConfidence < 0.70 AND 用户未手动修正该条目
  → 不触发：matchConfidence ≥ 0.70（规则库已够用）
  → 不触发：用户已修正（人工判断优先）
  ↓
[L11.2] 请求构建 + Sanitize（审查新增：防 prompt 注入）
  → OCR 文本 sanitize：
    - 去除 JSON 特殊字符：{ } [ ] " \
    - 限制长度 ≤ 200 字符（截断）
    - 去除连续空白
  → 发送到后端 API：/api/identify
  → 请求体（最小化数据原则）：
    {
      text: "COM BILL 1500",      // 仅 OCR 文字，已脱敏 + sanitized
      amount: 1500,
      context: "japanese_credit_card"  // 帮助 AI 理解语境
    }
  → 不发送：日期、用户信息、其他交易
  ↓
[L11.3] 后端调用 Gemini Flash-Lite（v1.4 修正：从 Haiku 改为 Gemini）
  → 使用 Google AI SDK（@google/generative-ai）
  → Model ID 从环境变量 GEMINI_MODEL_ID 读取（默认 gemini-2.5-flash-lite）
  → 使用 Gemini JSON mode（responseMimeType: "application/json"）
  → Prompt 模板：
    "以下はクレジットカード明細の一行です。
     テキスト：{text}
     金額：{amount}円

     これはどのサブスクリプションサービスですか？
     JSON形式で回答してください：
     { "service": "サービス名", "confidence": 0.0-1.0, "reasoning": "理由" }

     不明な場合は { "service": null, "confidence": 0.0 } と回答してください。"
  ↓
[L11.4] 响应解析与验证（v1.4 新增 Zod 校验）
  → 使用 Zod schema 严格校验 JSON 响应：
    z.object({
      service: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional()
    })
  → 验证：
    - service 是否在已知服务列表中（如果是 → 补充规则库候选）
    - confidence 是否在 0-1 范围内
    - Zod 校验失败 → 记录错误，标记为 unmatched
  ↓
[L11.5] 结果合并
  → 如果 AI confidence ≥ 0.80：
    - 更新该交易的 matchedRule
    - matchType 改为 "ai_assisted"
    - 重新触发苹果税 + 重叠检测
  → 如果 AI confidence < 0.80：
    - 保持 unmatched
    - 但在 UI 中显示 "AIの推測：{service}（確信度{confidence}）"
    - 用户可一键确认或拒绝
  ↓
[L11.6] 成本控制
  → Gemini 免费层限制：15 RPM, 1000 RPD（Flash-Lite）
  → 每次分析最多调用 5 次（5 条 unmatched 上限）
  → 超过 5 条 → 剩余的保持 unmatched，提示用户手动修正
  → 免费层额度用完 → 全部跳过（429 错误处理）
  → 注意：2026-07-22 Flash-Lite 退役，届时切换 GEMINI_MODEL_ID
  ↓
[L11.7] 调用失败降级
  → API 超时（> 5秒）→ 跳过，保持 unmatched
  → API 报错（429/500）→ 记录日志，跳过，保持 unmatched
  → 免费层额度用完 → 全部跳过
  → 任何失败都不影响已有结果
  ↓
输出：{
  aiAssistedCount: number,
  aiConfirmedCount: number,  // confidence ≥ 0.80
  aiSuggestedCount: number,  // confidence < 0.80，仅显示推测
  aiFailedCount: number,
  costThisSession: number
}
```

### 11.2 验证门 (Gate 11)

| 测试编号 | 测试内容 | 输入 | 期望输出 | 通过标准 |
|----------|---------|------|----------|---------|
| G11.1 | 正常识别 | text:"COM BILL 1500" | service:"Apple iCloud", conf ≥ 0.80 | ✅ |
| G11.2 | 低置信度 | text:"ABCXYZ 777" | service:null 或 conf < 0.80 | ✅ |
| G11.3 | 请求不含隐私 | 检查发送到 API 的数据 | 无日期、无用户信息 | ✅ |
| G11.4 | 5 次上限 | 8 条 unmatched | 仅前 5 条调用 Haiku | ✅ |
| G11.5 | API 超时降级 | 模拟 10 秒超时 | 跳过，保持 unmatched，不崩溃 | ✅ |
| G11.6 | API 报错降级 | 模拟 500 错误 | 跳过，保持 unmatched，不崩溃 | ✅ |
| G11.7 | 月度预算上限 | costThisMonth ≥ $10 | 自动停用，所有请求跳过 | ✅ |
| G11.8 | JSON 解析失败 | Haiku 返回非 JSON | 记录错误，标记 unmatched | ✅ |
| G11.9 | 高置信结果合并 | conf ≥ 0.80 | 苹果税和重叠检测重新运行 | ✅ |
| G11.10 | 结果不覆盖用户修正 | 用户已修正的条目 | Haiku 不覆盖，人工优先 | ✅ |
| G11.11 | Prompt 注入防御 | text 含 `{"service":"FAKE"}` | sanitize 后正常处理，不被操纵 | ✅ |
| G11.12 | 文本长度截断 | text 长度 500 字符 | 截断至 200 字符，正常调用 | ✅ |
| G11.13 | Haiku 幻觉过滤 | Haiku 返回不在规则库中的服务名 | 标记为 ai_suggested（非 confirmed），需用户确认 | ✅ |

**Gate 11 通过条件：13/13 全部通过，其中 G11.3（隐私）、G11.7（成本控制）、G11.11（注入防御）为硬性必过项**

---

## 集成测试（所有模块通过后）

### 端到端测试用例

| 测试编号 | 场景 | 输入 | 验证要点 |
|----------|------|------|----------|
| E2E.1 | 完美路径 | 清晰的日本信用卡账单含 5 个已知服务 | 全流程跑通，报告完整，评分正确 |
| E2E.2 | 苹果税场景 | 含 iCloud 2TB 的账单 | 检出苹果税 ¥200/月，年省 ¥2,400 |
| E2E.3 | 重叠场景 | 含 iCloud 2TB + Google One 2TB | 检出高度重叠，建议合并 |
| E2E.4 | 混合场景 | 苹果税 + 重叠 + 未知服务 | 三种标记同时出现，互不干扰 |
| E2E.5 | 模糊图片 | 低质量截图 | 警告 → OCR 降级 → 标记 unmatched → 优雅提示 |
| E2E.6 | Demo 模式 | 不上传任何文件 | 预加载数据展示完整报告 |
| E2E.7 | 双引擎切换 | iPhone Safari 上传 | 自动使用 Tesseract.js，不崩溃 |
| E2E.8 | 发卡机构选择 | 选择「楽天カード」后上传 | 使用楽天专用解析规则 |
| E2E.9 | 分享卡片 | 生成并检查 | 无个人信息，尺寸正确，可下载 |
| E2E.10 | 极端边界 | 空图片 / 全噪音 / 20+服务 | 不崩溃，优雅降级 |

---

## 验证门总览仪表盘（v1.1 修正版）

```
═══ MVP（6 周）═══
模块 1 图片输入      [  ] Gate 1:  0/10 通过  (HEIC 使用 @tuily/heic2any fork)
模块 2 OCR识别       [  ] Gate 2:  0/15 通过  (★ 双引擎 + G2.13-15 引擎切换)
模块 3 文字结构化    [  ] Gate 3:  0/14 通过  (★ 含发卡机构选择)
模块 4 规则库匹配    [  ] Gate 4:  0/16 通过  (本地 JSON 10 服务)
模块 5 苹果税检测    [  ] Gate 5:  0/7  通过
模块 6 重复订阅检测  [  ] Gate 6:  0/8  通过  (仅 cloud_storage)
模块 8 体检报告生成  [  ] Gate 8:  0/8  通过  (含 Demo 模式)
安全验证门           [  ] G_SEC:  0/5  通过  (★ v1.4 新增)
集成测试 (MVP)       [  ] E2E:    0/10 通过
MVP 小计：0/93 验证点

═══ v1.1（Alpha 后 2-3 周）═══
模块 7 敏感数据遮盖  [  ] Gate 7:  0/10 通过  (从 MVP 移至 v1.1)
模块 9 用户修正反馈  [  ] Gate 9:  0/8  通过
模块 10 本地历史存储 [  ] Gate 10: 0/9  通过  (含 IndexedDB feature detect)
模块 11 AI Fallback  [  ] Gate 11: 0/13 通过  (Gemini Flash-Lite + Zod 校验)
v1.1 小计：0/40 验证点

总计：0/133 验证点
硬性必过项：0/13 通过
```

### 硬性必过项清单（任何一项失败 = 不上线）

**MVP 硬性必过项（8 项）：**

| 编号 | 所属模块 | 内容 |
|------|---------|------|
| G2.8 | OCR | 金额数字 100% 正确识别 |
| G2.13 | OCR | ★ iOS Safari 自动选择 Tesseract.js |
| G3.4 | 结构化 | 所有金额格式正确标准化 |
| G4.13 | 匹配 | 10 服务规则库 100% 命中 |
| G6.5 | 重叠 | 误报过滤生效（Netflix + Prime 不标记） |
| G8.3 | 报告 | 金额明细与汇总一致 |
| G8.7 | 报告 | 分享卡片不含个人信息 |
| G_SEC.1 | 安全 | ★ HTTPS 强制（HTTP 请求被重定向） |

**安全验证门（G_SEC，v1.4 新增）：**

| 编号 | 内容 | 通过标准 |
|------|------|---------|
| G_SEC.1 | HTTPS 强制 | HTTP 请求被重定向到 HTTPS |
| G_SEC.2 | CSP header | script-src 仅允许 self + 必要的 CDN |
| G_SEC.3 | Rate limit | 第 11 次上传/小时被拒绝 |
| G_SEC.4 | Sentry 不含 PII | 人工检查错误日志无个人信息 |
| G_SEC.5 | Demo 模式 | 不上传任何文件即可看到完整示例报告 |

**v1.1 追加硬性必过项（5 项）：**

| 编号 | 所属模块 | 内容 |
|------|---------|------|
| G7.8 | 遮盖 | 遮盖自检通过 |
| G9.7 | 反馈 | 上报数据不含隐私 |
| G11.3 | AI | API 请求不含隐私 |
| G11.7 | AI | Gemini 免费层额度控制生效 |
| G11.11 | AI | Prompt 注入防御通过 |

---

## 开发规则

1. **W1 Day 1-3 必须完成 OCR Spike**：确认引擎可用后才开始正式模块开发
2. **严格按模块顺序开发**：模块 N 的 Gate 全部通过后才开始模块 N+1
3. **MVP 6 模块 + 安全门先上线**，v1.1 的 4 个模块 Alpha 后补全
4. **每个 Gate 测试必须有对应的自动化测试代码**（Vitest）
5. **硬性必过项失败 = 停止开发，优先修复**
6. **每个模块完成时，更新验证门仪表盘**
7. **集成测试 + 安全验证门在 MVP 模块全部完成后执行，通过后才能发布 Alpha**
8. **Alpha 上线前必须完成**：プライバシーポリシー + Sentry + HTTPS/CSP/Rate Limit + Demo 模式
