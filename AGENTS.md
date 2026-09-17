# 竞品情报抓取 · 业务口径（硬规则，违反即返工）

服务对象：唐山像素智能科技有限公司。目标：抓取 XRT 矿石智能分选 + 煤炭智能干选设备的公开招采/交易情报。

## 绝对不可违背

1. **时间窗**：只收 `publishDate >= 2026-01-01`（常量 `MINIMUM_PUBLISH_DATE`）。
2. **范围**：只收「采购/招标/中标」的**整机或系统**（XRT 矿石分选机、光电分选机、煤炭智能干选机、TDS 智能选矸系统）。**不收**：破碎/磨矿/磁选/浮选等非分选设备、检测装置、配件、维修、耗材、纯工程施工。**贸易商/设计院/工程总包中标的也不收**（要落到设备商）。
3. **金额**：只取公告原文官方披露的数字。缺失一律填 `"未披露"`，并在 `amountNote` 写明原因。**严禁推算、估算、引用第三方口径**。
4. **证据**：每条必须带 `evidence`（官方原文摘录，≥16 字符）+ `evidenceCapturedAt` + `sourceAuthority`。没有原文摘录不许入库。
5. **来源黑名单（硬拒，不做来源也不做交叉核验）**：企查查、天眼查、爱企查、启信宝、千里马、寻标宝、比比网、招投标信息网、中招联合、中国招标网（付费墙部分）。入库函数必须直接 reject 这些域名。
6. **不绕过登录/验证码/付费墙**。被拦截就如实记失败，不许伪造数据。

## 置信度两档（只此两档，公众号线索另计）

| 值 | 条件 |
|---|---|
| `高` | `sourceAuthority=official`，官方招采平台，`bidStatus ∈ {招标公告, 中标候选人, 已中标}` |
| `中` | `sourceAuthority=官方自宣`，竞品官网/官方自媒体，`bidStatus ∈ {已中标, 中标候选人, 已签约, 已交付, 已投运}` |
| `低` | 公众号标题线索（`gzh_ingest.mjs` 产出，只有标题+链接） |

来源分级：`anonymous`（公开）/ `login_free`（登录后免费可看正文）/ `login_paid`（付费，**整体排除**）。

## 14 家在册竞品（用了防混淆检索词）

天津美腾科技 / 唐山神州机械集团 / 威海市海王科技 / 霍里思特（北京·浙江·湖州三主体合并）/ 赣州好朋友科技 / 合肥泰禾卓海 / 枣庄海纳科技 / 丹东东方测控（仅干选·选矸类）/ 合肥奥博特 / 湖北金石智能装备 / 河北澳兰机械 / 湖南升华智选 / 同方威视（仅矿业分选线）/ 赣州吉瑞机械。
> 名单外的智能干选/光电分选设备制造商中标，也收录（标为新竞品）。
> 检索防混淆：不要用「神州机械」（命中山东 SZMC）、「海王科技」、「好朋友」、「海纳」、「澳兰机械」（命中金澳兰机床）等裸短词。

## 交易形态（不要只认「中标」二字）

直接销售合同（上市公司强制披露 → 巨潮 688420 美腾 / 603656 泰禾智能）、港交所合同公告（如南戈壁 01878.HK）、EPC 总包分包、租赁、BOT/运营合作、展会签约、发运/交付/验收/投运——**都算交易信号**。

## 数据与脚本

- 台账：`src/data/intelligence.flat.json`（主数据，数组）→ `scripts/group_projects.mjs` → `src/data/intelligence.json`（前端按项目合并）。
- 抓取：`scripts/weekly-run.mjs`（52 条规则，读 `config/scan-rules.json`），适配器见 `scripts/collect-lib.mjs`。
- 公众号线索：`scripts/gzh_ingest.mjs --query "<短词>" -n 8 --after <日期>`。
- **禁止改全局分类器 `classifyLine`**（已验证会误伤 39/113 条正确条目）。要过滤噪音一律用**规则级 `titleBlocklist`**。
- 平台清单：`config/platform-library.json`（分类/可爬性备注，不等于已接入）。
- 前端读 `intelligence.json`，改数据后**必须 `npm run build`** 才生效。
- 抓取时间戳：`src/data/crawl_stamp.json` 的 `lastCrawl`，**每轮必须更新**（前端 footer 靠它显示）。

## 交付流程（每轮固定）

1. 抓 → 2. 按 `title` 去重追加进 flat → 3. 更新 `crawl_stamp.json` → 4. `node scripts/group_projects.mjs`（须输出状态校验通过）→ 5. `npx vite build` 验证 → 6. `git add src/data/... && git commit && git push origin main:main`。
> 推送后 GitHub Actions 自动构建部署到 Pages。**核验部署**：抓 `https://white1star.github.io/Xiangsu/data/latest-run.json` 比对 `generatedAt`（勿用 api.github.com/actions，已 403）。
> **自动抓取已停用（2026-09-17 用户决定）**：本机 WorkBuddy 周一 09:00 定时任务已取消，GitHub Actions 的星期定时触发也已移除（仅保留手动 workflow_dispatch）。抓取改为按需人工发起，交付流程不变。

## 入库前自检（缺一不可）

`title` / `url` / `source` / `publishDate` / `bidStatus` / `evidence` 齐全；日期 ≥ 2026-01-01；命中目标产品线；来源不在黑名单；`bidStatus` 与 `sourceAuthority` 匹配上表。任一不满足 → 不入库。

---

# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
