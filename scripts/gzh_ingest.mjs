// gzh_ingest.mjs — 公众号线索收集（竞品情报流程 步骤 2.6 的收录闭环）
// 用途：把「skill 抓公众号标题/链接 + 搜狗第三方源」的结果，与台账/线索池三方去重后，
//       写入独立线索文件 src/data/wechat-leads.json（前端「公众号线索」页展示）。
//       ⚠ 公众号内容**不入台账**（用户口径 2026-09-22）：只保留标题+摘要+日期+公众号名+链接。
//
// 流程：
//   ① skill(wechat-article-search) 抓公众号标题+链接（搜狗 type=2，同第三方数据源）
//   ② 对能解析出 mp 直链的文章，尝试抓正文（gzh_fetch.mjs 已封装，时灵时不灵）
//   ③ 与高/中置信台账、聚合线索池、既有公众号线索三方去重（mergeWechatLeads）
//   ④ 命中交易信号词 → 写入 wechat-leads.json；confidence=低，须官方公告核验后才可入台账
//
// 用法：
//   node scripts/gzh_ingest.mjs --query "天津美腾科技 中标" [-n 10] [--after 2026-01-01] [--dry-run]
//   或直接喂 JSON：node scripts/gzh_ingest.mjs --file gzh_report.json [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mergeWechatLeads } from './weekly-run.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const FLAT = path.resolve(__dirname, '../src/data/intelligence.flat.json');
const PENDING = path.resolve(__dirname, '../src/data/pending-review.json');
const WECHAT = path.resolve(__dirname, '../src/data/wechat-leads.json');

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

const MINIMUM_PUBLISH_DATE = '2026-01-01';

// 交易信号词（标题命中即视为潜在交易线索，按用户 15:40 定案口径）
const TRADE_WORDS = /中标|签约|成交|订单|交付|验收|喜报|合同|预中标|候选|投产|投运|发运|试运行|框架|采购|招标|中标结果/;

// 非交易词（展会/荣誉/党建/软文等，命中即排除）
const NON_TRADE_WORDS = /展会|展览|荣誉|荣获|获评|认定|表彰|先进集体|党建|团建|慰问|招聘|致歉|上市|年报|季报|半年报|研报|周报|解读|科普|专访|盘点|回顾|展望|论坛|峰会|大会|培训|讲座|活动报名|颁奖|授牌|揭牌/;

// 竞品名/产品词（用于判断是否属于本情报范围，命中才收）
const SCOPE_WORDS = /智能干选|智能分选|XRT|光电分选|干选机|分选机|TDS|选煤|选矿|煤矸|矿石分选|干法选煤|抛废|美腾|神州|海王|霍里思特|好朋友|泰禾|东方测控|奥博特|金石|澳兰|升华|同方威视|吉瑞|凡口|X射线/;

const TRADE_TO_BID = {
  '中标结果': '已中标', '中标': '已中标', '预中标': '中标候选人', '候选': '中标候选人',
  '签约': '已签约', '合同': '已签约', '成交': '已签约', '订单': '已签约', '框架': '已签约',
  '交付': '已交付', '发运': '已交付',
  '验收': '已交付', '投产': '已投运', '投运': '已投运', '试运行': '已投运',
  '喜报': '已中标', '采购': '招标公告', '招标': '招标公告',
};

function mapBid(title) {
  for (const [kw, bid] of Object.entries(TRADE_TO_BID)) {
    if (title.includes(kw)) return bid;
  }
  return '已中标'; // 兜底：命中交易词但无更具体语义，按已中标（需人工复核）
}

function classifyTitle(title) {
  if (NON_TRADE_WORDS.test(title)) return { hit: false, reason: '非交易内容（展会/荣誉/软文）' };
  if (!TRADE_WORDS.test(title)) return { hit: false, reason: '标题无交易信号词' };
  if (!SCOPE_WORDS.test(title)) return { hit: false, reason: '不在本情报范围（非分选/干选设备）' };
  return { hit: true };
}

// 从 gzh_fetch.mjs 的 JSON 报告解析文章列表（兼容直接喂 skill 原始输出）
function normalizeArticles(report) {
  const list = Array.isArray(report) ? report : (report.results || report.articles || []);
  return list.map(a => ({
    title: (a.title || '').trim(),
    account: a.account || a.source || '(公众号未提取)',
    datetime: a.datetime || a.date_text || '',
    summary: (a.summary || '').replace(/\s+/g, ' ').trim(),
    sogouUrl: a.sogouUrl || a.url || '',
    mpUrl: a.mpUrl || '',
    url_resolved: !!a.url_resolved || !!a.mpUrl,
    textLength: a.article?.textLength || a.text?.length || 0,
    text: a.article?.text || a.text || '',
  })).filter(a => a.title);
}

function loadLedger() {
  try { return JSON.parse(readFileSync(FLAT, 'utf8')); }
  catch { return []; }
}

function parseArgs(argv) {
  const args = { query: '', num: 10, after: MINIMUM_PUBLISH_DATE, file: '', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--query' || v === '-q') args.query = argv[++i];
    else if (v === '-n') args.num = parseInt(argv[++i], 10) || 10;
    else if (v === '--after') args.after = argv[++i];
    else if (v === '--file' || v === '-f') args.file = argv[++i];
    else if (v === '--dry-run') args.dryRun = true;
    else if (!v.startsWith('-')) args.query = v;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.query && !args.file) {
    console.log('用法:\n  node scripts/gzh_ingest.mjs "天津美腾科技 中标" [-n 10] [--after 2026-01-01] [--dry-run]\n  node scripts/gzh_ingest.mjs --file gzh_report.json [--dry-run]');
    process.exit(0);
  }

  let report;
  if (args.file) {
    report = JSON.parse(readFileSync(path.resolve(args.file), 'utf8'));
  } else {
    // 调用 gzh_fetch.mjs 抓取（内部走 skill 的搜狗 type=2 搜索 + 正文提取）
    const gzh = path.resolve(__dirname, 'gzh_fetch.mjs');
    const outFile = path.resolve(__dirname, `../_gzh_ingest_${Date.now()}.json`);
    const r = spawnSync(process.execPath, [gzh, args.query, '-n', String(args.num), '--after', args.after, '-o', outFile], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status === 2) { console.log('⚠ 搜索返回 0 条（限流/无结果），本次不落库'); process.exit(0); }
    if (r.status !== 0) { console.log('抓取失败，退出'); process.exit(r.status || 1); }
    report = JSON.parse(readFileSync(outFile, 'utf8'));
    try { require('node:fs').unlinkSync(outFile); } catch {}
  }

  const articles = normalizeArticles(report);
  console.log(`抓取到 ${articles.length} 条公众号文章，开始与台账/线索池去重 ...`);

  const ledger = loadLedger();
  const pending = readJson(PENDING, []);
  const existingLeads = readJson(WECHAT, []);

  const candidates = [];
  const skipped = { notTrade: 0, outOfScope: 0 };
  const afterTs = new Date(args.after + 'T00:00:00+08:00').getTime();

  for (const a of articles) {
    const dt = a.datetime.replace(' ', 'T');
    const ts = dt ? new Date(dt + (dt.includes('+') ? '' : '+08:00')).getTime() : 0;
    const date = (a.datetime || '').slice(0, 10) || '未披露';
    if (ts && ts < afterTs) { skipped.outOfScope++; continue; }

    const cls = classifyTitle(a.title);
    if (!cls.hit) { skipped.notTrade++; continue; }

    candidates.push({
      title: a.title,
      url: a.mpUrl || a.sogouUrl,
      account: a.account,
      summary: a.summary || (a.textLength > 0 ? a.text.slice(0, 120) : '标题含交易信号词，正文未抓取，须点原文自看'),
      publishDate: date === '未披露' ? MINIMUM_PUBLISH_DATE : date,
      line: /煤|干法选煤|干选|选煤/.test(a.title) ? '煤炭智能干选设备' : '矿石XRT光电分选设备',
      bidStatus: mapBid(a.title),
      via: '搜狗收录',
      query: args.query || '',
      source: `微信公众号·${a.account}`,
      confidence: '低',
    });
  }

  // 与 高/中置信台账、聚合线索池、既有公众号线索三方去重后写入独立线索文件（不入台账）。
  const mergedLeads = mergeWechatLeads(existingLeads, ledger, pending, candidates);
  const added = mergedLeads.added;
  const dup = candidates.length - added.length;

  console.log(`\n分类结果：新增 ${added.length} 条 | 去重 ${dup} | 非交易 ${skipped.notTrade} | 超窗/无日期 ${skipped.outOfScope}`);

  if (args.dryRun) {
    console.log('\n=== 试运行（--dry-run，不写文件）新增明细 ===');
    added.forEach(a => console.log(`- [${a.publishDate}] ${a.bidStatus} | ${a.title.slice(0, 50)}`));
    process.exit(0);
  }

  if (added.length === 0) { console.log('无新增，公众号线索不变'); process.exit(0); }

  writeFileSync(WECHAT, JSON.stringify(mergedLeads.leads, null, 2) + '\n');
  console.log(`\n已写入 ${WECHAT}：公众号线索 ${existingLeads.length} → ${mergedLeads.leads.length} 条（新增 ${added.length} 条，仅进「公众号线索」页，不入台账）`);
  console.log('提醒：前端构建/推送后生效；线索须官方公告核验后才可入台账。');
}

main().catch(e => { console.error('执行失败:', e.message); process.exit(1); });
