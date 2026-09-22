// gzh_sweep.mjs — 公众号线索「关键词矩阵轮询」（步骤 2.6 的日常执行器）
//
// 背景：搜狗微信只有基础关键词搜索可用（时间排序/账号主页/搜索引擎补漏经 2026-09-18 实测均失效），
//       破局办法是在频控内把每日配额用满、按矩阵轮换着搜，逐步把竞品相关的历史文章捞全。
//
// 用法：
//   node scripts/gzh_sweep.mjs [--max 3] [--interval 65] [--daily-cap 12] [--dry-run] [--list]
//     --max        本次最多跑几个检索词（默认 3）
//     --interval   词之间间隔秒数（默认 65，防搜狗频控）
//     --daily-cap  每日最多检索次数（默认 12）
//     --dry-run    只打印本次计划，不执行
//     --list       打印矩阵与状态后退出
//
// 状态文件：reports/gzh-sweep-state.json（本地保留；包含每个词的最后运行时间/次数/累计新增）

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'reports', 'gzh-sweep-state.json');

const VENDORS = ['天津美腾科技', '唐山神州机械', '霍里思特', '合肥泰禾卓海', '好朋友科技', '威海海王科技', '枣庄海纳科技', '东方测控', '合肥奥博特', '湖北金石智能', '河北澳兰', '湖南升华智选', '同方威视', '赣州吉瑞'];
const DEVICES = ['智能干选', 'XRT 智能分选', '光电分选', 'TDS 智能选矸'];

// 查询矩阵：14 家竞品 × 中标 + 4 产品词 × 中标/签约/喜报/交付（共 30 个）
export function buildQueryMatrix() {
  return [
    ...VENDORS.map(name => `${name} 中标`),
    ...DEVICES.map(name => `${name} 中标`),
    ...DEVICES.map(name => `${name} 签约`),
    ...DEVICES.map(name => `${name} 喜报`),
    ...DEVICES.map(name => `${name} 交付`),
  ];
}

// 状态 → 本次执行计划：每日配额内、且最近 20 小时没跑过的词，按最久未跑优先
export function pickQueries(matrix, state, now, maxCount, dailyCap) {
  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const dailyCount = state.dailyDate === today ? state.dailyCount : 0;
  const remaining = Math.max(0, dailyCap - dailyCount);
  const limit = Math.min(maxCount, remaining);
  const twentyHoursAgo = now - 20 * 3600 * 1000;
  return matrix
    .filter(query => {
      const entry = state.queries[query];
      return !entry || !entry.lastRunAt || new Date(entry.lastRunAt).getTime() < twentyHoursAgo;
    })
    .sort((a, b) => {
      const ta = state.queries[a]?.lastRunAt ? new Date(state.queries[a].lastRunAt).getTime() : 0;
      const tb = state.queries[b]?.lastRunAt ? new Date(state.queries[b].lastRunAt).getTime() : 0;
      return ta - tb;
    })
    .slice(0, limit);
}

function loadState() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch { return { dailyDate: '', dailyCount: 0, queries: {} }; }
}

function saveState(state) {
  if (!existsSync(path.dirname(stateFile))) mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 1) + '\n', 'utf8');
}

function parseArgs(argv) {
  const out = { max: 3, interval: 65, dailyCap: 12, dryRun: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max') out.max = parseInt(argv[++i], 10) || 3;
    else if (a === '--interval') out.interval = parseInt(argv[++i], 10) || 65;
    else if (a === '--daily-cap') out.dailyCap = parseInt(argv[++i], 10) || 12;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--list') out.list = true;
  }
  return out;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrix = buildQueryMatrix();
  const state = loadState();
  const now = Date.now();

  if (args.list) {
    const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
    console.log(`矩阵 ${matrix.length} 个词；今日已跑 ${state.dailyDate === today ? state.dailyCount : 0}/${args.dailyCap}`);
    const rows = matrix.map(q => ({ q, last: state.queries[q]?.lastRunAt || '从未', runs: state.queries[q]?.runs || 0, added: state.queries[q]?.added || 0 }));
    rows.sort((a, b) => String(a.last).localeCompare(String(b.last)));
    for (const r of rows) console.log(`- ${r.q} | 上次 ${r.last} | ${r.runs}次 | 累计新增 ${r.added}`);
    return;
  }

  const plan = pickQueries(matrix, state, now, args.max, args.dailyCap);
  if (!plan.length) {
    console.log('今日配额已用满或所有词 20 小时内已跑过，无需执行（可用 --daily-cap 放宽）。');
    return;
  }
  console.log(`本次计划跑 ${plan.length} 个词（间隔 ${args.interval}s）：${plan.join(' / ')}`);
  if (args.dryRun) return;

  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  if (state.dailyDate !== today) { state.dailyDate = today; state.dailyCount = 0; }

  let totalAdded = 0;
  for (let i = 0; i < plan.length; i++) {
    const query = plan[i];
    console.log(`\n[${i + 1}/${plan.length}] 抓「${query}」...`);
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'gzh_ingest.mjs'), query, '-n', '8', '--after', '2026-01-01'], { cwd: root, encoding: 'utf8' });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const addedMatch = output.match(/新增 (\d+) 条/);
    const added = addedMatch ? Number(addedMatch[1]) : 0;
    totalAdded += added;
    state.dailyCount += 1;
    state.queries[query] = state.queries[query] || { runs: 0, added: 0 };
    state.queries[query].lastRunAt = new Date().toISOString();
    state.queries[query].runs += 1;
    state.queries[query].added += added;
    state.queries[query].lastResult = (output.match(/分类结果：([^\n]*)/) || [, ''])[1].trim();
    saveState(state);
    const tail = output.split('\n').filter(l => /抓取到|分类结果|新增|无新增|0 条/.test(l)).slice(0, 3).join(' | ');
    console.log(`  → ${tail || '（无摘要）'}`);
    if (i < plan.length - 1) {
      console.log(`  等待 ${args.interval}s 防频控...`);
      sleepSync(args.interval * 1000);
    }
  }
  console.log(`\n本轮完成：${plan.length} 个词，新增线索 ${totalAdded} 条（今日累计 ${state.dailyCount}/${args.dailyCap}）。`);
  if (totalAdded > 0) console.log('提醒：有新增 → 提交推送 src/data/wechat-leads.json（「公众号线索」页展示，不入台账）。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('执行失败:', e.message); process.exit(1); });
}
