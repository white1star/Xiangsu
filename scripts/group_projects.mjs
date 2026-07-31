// 将平铺台账按"项目"分组：一个项目一条记录，含完整阶段时间线
// 输入: src/data/intelligence.flat.json（平铺，抓取管道的直接产物）
// 输出: src/data/intelligence.json（分组后，前端消费）
// 该脚本是抓取管道的固定末级步骤：weekly-run.mjs 写完平铺数据后自动调用
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const OUT = 'src/data/intelligence.json';

// 首次运行（尚无平铺档案）时，把当前 intelligence.json 当作平铺输入并留档
if (!existsSync(FLAT)) {
  writeFileSync(FLAT, readFileSync(OUT, 'utf8'));
}
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

// ---------- 项目键归一化 ----------
function projKey(title) {
  let s = (title || '').replace(/[\[【\]】]/g, '').replace(/\s+/g, '');
  // 轮次/重发标记
  s = s.replace(/[（(](第?[一二三四五2-5]次(发询)?|日常采购|重新招标|\d+次)[)）]/g, '');
  s = s.replace(/重新招标|变更公告|\[?询比价采购\]?/g, '');
  // 循环剥离阶段后缀
  const stage = /(中标（成交）结果公告|中标候选人公示|中标结果公[示告]|评标结果公示|候选人公示|中标公示|成交结果公告|成交公告|竞争性谈判公告|招标公告|采购公告|询价公告|结果公[示告]|中标|公示|公告)$/;
  let prev;
  do { prev = s; s = s.replace(stage, ''); } while (s !== prev);
  s = s.replace(/招标$/, ''); // 去掉阶段后缀剥离后残留的“招标”（如“…集中招标（…）招标”）
  s = s.replace(/[\s\-—_、，,。.·（）()]/g, '');
  return s;
}

// 疑难组显式规则（防止标段合错 / 跨平台同项目漏合）——按顺序首个命中生效
const HINTS = [
  [/古城煤矿.*矿建工程/, 'HINT::潞安古城矿建工程'],
  [/古城煤矿.*设备安装/, 'HINT::潞安古城设备安装'],
  [/保德选煤厂智能干选改造/, 'HINT::神东保德干选改造EPC'],
  [/榆树岭煤矿.*TDS.*配件/, 'HINT::豫能榆树岭TDS配件年采'],
  [/金鼎公司金腾公司.*易损备件/, 'HINT::晋能金鼎干选机备件'],
  [/红会第一煤矿.*智能干选系统/, 'HINT::靖煤红会一矿干选PC总包'],
  [/山寨煤矿末煤干选设备租赁/, 'HINT::华能山寨末煤干选租赁'],
  [/陈家沟煤矿.*砚北煤矿.*配件/, 'HINT::华能陈家沟砚北配件'],
];
function keyOf(r) {
  const t = r.title || '';
  for (const [re, k] of HINTS) if (re.test(t)) return k;
  return projKey(t);
}

// ---------- 分组 ----------
const groups = new Map();
for (const r of data) {
  const k = keyOf(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

// 流标排最低：绝不能让流标记录冒充中标；但若项目最新阶段就是流标，项目状态强制回落为流标
const RANK = { '已中标': 3, '中标候选人': 2, '招标公告': 1, '招标计划': 1, '流标': 0 };
const rank = r => RANK[r.bid] || RANK[r.bidStatus] || 1;
const AMT_LABEL = { 3: '中标价', 2: '候选报价', 1: '招标控制价/预算' };
const hasAmt = r => r.amount && !/未披露/.test(r.amount);

const projects = [];
for (const [k, arr] of groups) {
  // 时间线升序
  const tl = arr.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  // 主记录：阶段最高，同阶段取最新
  const primary = arr.slice().sort((a, b) => rank(b) - rank(a) || (b.date || '').localeCompare(a.date || ''))[0];
  // 金额：阶段从高到低找第一个有真实金额的
  const amtRec = arr.slice().sort((a, b) => rank(b) - rank(a) || (b.date || '').localeCompare(a.date || '')).find(hasAmt);
  // 中标人：优先取有 competitor 且非未披露的最高阶段记录
  const compRec = arr.slice().sort((a, b) => rank(b) - rank(a)).find(r => r.competitor && !/未披露/.test(r.competitor));

  const proj = { ...primary };
  proj.projectKey = k.replace(/^HINT::/, '');
  if (amtRec) {
    proj.amount = amtRec.amount;
    proj.amountStage = AMT_LABEL[rank(amtRec)];
    proj.amountNote = amtRec.amountNote || undefined;
    if (!proj.amountNote) delete proj.amountNote;
  } else {
    proj.amount = '未披露';
    // 保留主记录的未披露原因
    proj.amountNote = primary.amountNote || tl.map(r => r.amountNote).find(Boolean);
    if (!proj.amountNote) delete proj.amountNote;
  }
  if (compRec) proj.competitor = compRec.competitor;
  // 候选名单（竞品维度）：合并该项目所有阶段的 bids，按公司去重，取最高阶段报价
  const bidMap = new Map();
  for (const r of arr) {
    if (Array.isArray(r.bids)) for (const b of r.bids) {
      if (!b || !b.company) continue;
      const key = b.company.replace(/\s|（.*?）|\(.*?\)/g, '');
      const prev = bidMap.get(key);
      if (!prev || (b.quoteYuan && (!prev.quoteYuan || b.quoteYuan > prev.quoteYuan))) {
        bidMap.set(key, { ...b, _stageDate: r.date || '' });
      }
    }
  }
  if (bidMap.size) {
    proj.bids = [...bidMap.values()].sort((a, b) => (a.rank || 9) - (b.rank || 9));
    // 中标方标记
    const winName = (proj.winner || proj.competitor || '').replace(/\s|（.*?）|\(.*?\)/g, '');
    if (winName && proj.bids.length) {
      const w = proj.bids.find(b => b.company.replace(/\s|（.*?）|\(.*?\)/g, '') === winName);
      if (w) w.isWinner = true;
    }
  }
  // 采购人/预算/采购内容/开标日期/规格：任一记录有就带上
  for (const f of ['buyer', 'budget', 'procurement', 'bidOpenDate', 'openStatus', 'specs', 'amountNote']) {
    if (!proj[f]) { const v = tl.map(r => r[f]).find(Boolean); if (v) proj[f] = v; }
  }
  proj.timeline = tl.map(r => ({
    date: r.date, bid: r.bid || r.bidStatus, title: r.title,
    amount: r.amount || '未披露', url: r.url, source: r.source,
    ...(r.amountNote ? { amountNote: r.amountNote } : {}),
  }));
  proj.stages = tl.length;

  // ---- 状态一致性守卫（防止流标/候选被误显示为已中标）----
  const latest = tl[tl.length - 1];
  if (latest && (latest.bid === '流标' || latest.bidStatus === '流标')) {
    // 最新阶段是流标：除非之后另有中标记录，否则项目状态回落为流标
    const laterAward = tl.some(r => r.bid === '已中标' && (r.date || '') > (latest.date || ''));
    if (!laterAward) {
      proj.bid = '流标';
      proj.bidStatus = '流标';
      delete proj.winner;
      proj.statusNote = '本项目最新公告为招标失败/流标，尚未产生中标人';
    }
  }
  if (proj.bid === '已中标' && !proj.winner && !(proj.competitor && !/未披露/.test(proj.competitor))) {
    proj.bid = '中标候选人';
    proj.bidStatus = '中标候选人';
    proj.statusNote = '公告未明确中标人，按候选阶段保守标注';
  }

  projects.push(proj);
}

projects.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
writeFileSync(OUT, JSON.stringify(projects, null, 2));

// ---------- 汇总 ----------
console.log(`平铺 ${data.length} 条 -> 项目 ${projects.length} 个（原始数据已留档 intelligence.flat.json）`);
console.log('有金额项目:', projects.filter(hasAmt).length, '| 未披露:', projects.filter(p => !hasAmt(p)).length);
const st = {}; for (const p of projects) st[p.bid] = (st[p.bid] || 0) + 1;
console.log('状态分布:', st);
const bad = projects.filter(p => p.bid === '已中标' && !p.winner);
console.log(bad.length ? `⚠ 已中标但缺中标人 ${bad.length} 个：` + bad.map(p => p.title.slice(0, 20)).join(' / ') : '✓ 状态校验通过：所有"已中标"项目均有明确中标人，流标项目未被误标');
console.log('\n多阶段项目:');
for (const p of projects.filter(p => p.stages > 1).sort((a, b) => b.stages - a.stages)) {
  console.log(` [${p.stages}条] ${p.bid} | ${p.amount}${p.amountStage ? '(' + p.amountStage + ')' : ''} | ${(p.projectKey || p.title).slice(0, 40)}`);
  p.timeline.forEach(t => console.log(`     ${t.date} ${t.bid} ${t.amount}`));
}
