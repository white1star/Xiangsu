# 竞品情报抓取 · 业务口径（硬规则，违反即返工）

服务对象：唐山像素智能科技有限公司。目标：抓取 XRT 矿石智能分选 + 煤炭智能干选设备的公开招采/交易情报。

## 绝对不可违背

1. **时间窗**：只收 `publishDate >= 2026-01-01`（常量 `MINIMUM_PUBLISH_DATE`）。
2. **范围**：只收「采购/招标/中标」的**整机或系统**（XRT 矿石分选机、光电分选机、煤炭智能干选机、TDS 智能选矸系统）。**不收**：破碎/磨矿/磁选/浮选等非分选设备、检测装置、配件、维修、耗材、纯工程施工。**贸易商/设计院/工程总包中标的也不收**（要落到设备商）。
3. **金额**：只取公告原文官方披露的数字。缺失一律填 `"未披露"`，并在 `amountNote` 写明原因。**严禁推算、估算、引用第三方口径**。
4. **证据**：每条必须带 `evidence`（官方原文摘录，≥16 字符）+ `evidenceCapturedAt` + `sourceAuthority`。没有原文摘录不许入库。
5. **来源黑名单（硬拒，不做来源也不做交叉核验）**：企查查、天眼查、爱企查、启信宝、千里马、寻标宝、比比网、招投标信息网、中招联合、中国招标网（付费墙部分）。入库函数必须直接 reject 这些域名。
6. **不绕过登录/验证码/付费墙**。被拦截就如实记失败，不许伪造数据。

## 置信度两档（台账只此两档；公众号线索不入台账）

| 值 | 条件 |
|---|---|
| `高` | `sourceAuthority=official`，官方招采平台，`bidStatus ∈ {招标公告, 中标候选人, 已中标}` |
| `中` | `sourceAuthority=官方自宣`，竞品官网/官方自媒体，`bidStatus ∈ {已中标, 中标候选人, 已签约, 已交付, 已投运}` |

**公众号线索（confidence=低）不入台账**（用户口径 2026-09-22）：只存 `src/data/wechat-leads.json`（前端「公众号线索」页展示，标题+摘要+日期+公众号名+链接），须官方公告核验后才可升级入台账。

来源分级：`anonymous`（公开）/ `login_free`（登录后免费可看正文）/ `login_paid`（付费，**整体排除**）。

## 14 家在册竞品（用了防混淆检索词）

天津美腾科技 / 唐山神州机械集团 / 威海市海王科技 / 霍里思特（北京·浙江·湖州三主体合并）/ 赣州好朋友科技 / 合肥泰禾卓海 / 枣庄海纳科技 / 丹东东方测控（仅干选·选矸类）/ 合肥奥博特 / 湖北金石智能装备 / 河北澳兰机械 / 湖南升华智选 / 同方威视（仅矿业分选线）/ 赣州吉瑞机械。
> 名单外的智能干选/光电分选设备制造商中标，也收录（标为新竞品）。
> 检索防混淆：不要用「神州机械」（命中山东 SZMC）、「海王科技」、「好朋友」、「海纳」、「澳兰机械」（命中金澳兰机床）等裸短词。

## 交易形态（不要只认「中标」二字）

直接销售合同（上市公司强制披露 → 巨潮 688420 美腾 / 603656 泰禾智能）、港交所合同公告（如南戈壁 01878.HK）、EPC 总包分包、租赁、BOT/运营合作、展会签约、发运/交付/验收/投运——**都算交易信号**。

## 数据与脚本

- 台账：`src/data/intelligence.flat.json`（主数据，数组）→ `scripts/group_projects.mjs` → `src/data/intelligence.json`（前端按项目合并）。
- 抓取：`scripts/weekly-run.mjs`（59 条规则，读 `config/scan-rules.json`），适配器见 `scripts/collect-lib.mjs`。
- 定向反查（旧账更新）：`scripts/recheck_unresolved.mjs [--apply] [--limit N]`——对台账未完结项目在 ggzy/必联/国信e采/十环做定向复查，报告落 `reports/recheck-<日期>.json`；`--apply` 时仅官方/公开源结果公告可回填（十环为聚合线索不回填），自动备份 + 重生成分组。
- 公众号线索：单次 `scripts/gzh_ingest.mjs --query "<短词>" -n 8 --after <日期>`；日常轮询用 `scripts/gzh_sweep.mjs`（30 词矩阵，默认每次 3 词、间隔 65s、每日上限 12 次，状态存 `reports/gzh-sweep-state.json`）。**口径=相关即收（2026-09-22）**：标题含设备/竞品词即收，有交易信号标信号、否则「非交易动态」；产出只写 `src/data/wechat-leads.json`（不入台账）。⚠ 搜狗的时间排序（tsn/sort）、账号主页（type=1）、搜索引擎补漏（百度验证/必应降级/360 无收录/Google JS 壳）2026-09-18 全部实测失效，不要重复尝试；扩充只能靠矩阵轮询频率与（若有）自有公众号后台超链接搜索。
- **禁止改全局分类器 `classifyLine`**（已验证会误伤 39/113 条正确条目）。要过滤噪音一律用**规则级 `titleBlocklist`**。
- 平台清单：`config/platform-library.json`（分类/可爬性备注，不等于已接入）。
- 前端读 `intelligence.json`，改数据后**必须 `npm run build`** 才生效。
- 抓取时间戳：`src/data/crawl_stamp.json` 的 `lastCrawl`，**每轮必须更新**（前端 footer 靠它显示）。

## 交付流程（每轮固定）

1. 抓 → 2. 按 `title` 去重追加进 flat → 3. 更新 `crawl_stamp.json` → 4. `node scripts/group_projects.mjs`（须输出状态校验通过）→ 5. `npx vite build` 验证 → 6. `git add src/data/... && git commit && git push origin main:main`。
> 推送后 GitHub Actions 自动构建部署到 Pages。**核验部署**：抓 `https://white1star.github.io/Xiangsu/data/latest-run.json` 比对 `generatedAt`（勿用 api.github.com/actions，已 403）。
> **每日自动抓取已迁移到北京服务器（2026-09-24）**：服务器 `/opt/xiangsu/daily_update.sh` 每天 05:30（北京时间）抓取 → 提交推送 main（GitHub Pages 自动重建）→ 本地构建并覆盖门户 `39.96.27.206/Xiangsu/`。GitHub Actions 云端定时已停用（仅保留手动 workflow_dispatch 兜底）；运维记录见 `E:\矿_news\.superpowers\sdd\server_deploy.md`。

## 入库前自检（缺一不可）

`title` / `url` / `source` / `publishDate` / `bidStatus` / `evidence` 齐全；日期 ≥ 2026-01-01；命中目标产品线；来源不在黑名单；`bidStatus` 与 `sourceAuthority` 匹配上表。任一不满足 → 不入库。

---

# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
