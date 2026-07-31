// 深挖未披露金额：用特征词在 ggzy 全国 API 交叉搜索同项目公告（公开版/后续阶段）
// 命中的新公告 append 进 intelligence.flat.json，由 group_projects.mjs 合并进项目时间线
import { readFileSync, writeFileSync } from 'node:fs';
import { UA, sleep, fetchSolid, htmlText, extractAmount, extractWinnerName, extractBuyerName } from './amount-lib.mjs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));
const known = new Set(data.map(r => normUrl(r.url)));

function normUrl(u) {
  if (!u) return '';
  try { const p = new URL(u); return (p.host + p.pathname).replace(/\/$/, ''); } catch { return u; }
}

// —— 27个未披露项目的特征搜索词（手工指定，保证命中率）——
const QUERIES = [
  { q: '阳升洁煤运销', proj: '晋能阳升洁煤系列采购' },
  { q: '红四煤矿', proj: '宝丰红四煤矿煤矸分离' },
  { q: '汾西正善', proj: '汾西正善智能干选改造' },
  { q: '金腾公司', proj: '金鼎金腾易损备件' },
  { q: '金鼎公司 智能干选', proj: '金鼎金腾易损备件' },
  { q: '智能干选初步设计', proj: '阜阳矿业选煤厂初设' },
  { q: '土城矿 智能干选', proj: '盘江土城矿' },
  { q: '金佳矿 干选', proj: '盘江金佳矿配件' },
  { q: '党家河', proj: '鹤壁党家河TDS施工' },
  { q: '汪家寨', proj: '达旺汪家寨新建干选' },
  { q: '漳村煤矿 干选', proj: '潞安漳村维保' },
  { q: '屯宝煤矿', proj: '新疆能源屯宝配件' },
  { q: '榆树岭煤矿', proj: '豫能榆树岭配件年采' },
  { q: '准能 干选机', proj: '准能配件集采' },
  { q: '玲珑 分选机', proj: '山东黄金玲珑光电分选' },
  { q: '光电智能分选机', proj: '山东黄金玲珑光电分选' },
  { q: '铁煤集团 智能选矸', proj: '铁煤98批集采' },
  { q: '智能选矸系统 集成供液', proj: '铁煤98批集采' },
  { q: '坑下干选', proj: '胜利能源坑下干选移设' },
  { q: '胜利能源 干选', proj: '胜利能源坑下干选移设' },
  { q: '大南湖一矿', proj: '国源大南湖一矿干选建设' },
  { q: '块煤智能干选技术与装备', proj: '中煤科工华宇实验室' },
  { q: '中富矿业', proj: '新疆中富干选机采购' },
  { q: '并联机器人 选矸', proj: '西安科大并联机器人' },
  { q: '红会第一煤矿', proj: '靖煤红会一矿PC总包' },
  { q: '美腾 配件', proj: '淮北美腾主机配件' },
  { q: '山寨煤矿 干选', proj: '华亭山寨末煤干选租赁' },
  { q: '陈家沟 干选机', proj: '华能陈家沟配件集采' },
];

const API = 'https://www.ggzy.gov.cn/information/pubTradingInfo/getTradList';
const WINDOW = { from: '2025-08-05', to: '2026-07-31' }; // DEAL_TIME=13 自定义区间不得超过一年，否则 code 400

function classify(title) {
  if (/中标候选人|评标结果公示/.test(title)) return '中标候选人';
  if (/中标结果|中标公[示告]|成交(结果|公告|公示)|结果公[告示]/.test(title)) return '已中标';
  return '招标公告';
}

async function searchGgzy(q) {
  const out = [];
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, 3); page++) {
    const form = new URLSearchParams({ DEAL_TIME: '13', TIMEBEGIN: WINDOW.from, TIMEEND: WINDOW.to, FINDTXT: q, PAGENUMBER: String(page) });
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA, referer: 'https://www.ggzy.gov.cn/deal/dealList.html' },
        body: form.toString(), signal: AbortSignal.timeout(30000),
      });
      if (res.status !== 200) { console.log(`   [${q}] HTTP ${res.status}`); break; }
      const p = JSON.parse(await res.text());
      if (p.code === 829) { console.log(`   [${q}] 验证码限流，冷却30s`); await sleep(30000); break; }
      if (p.code !== 200) { console.log(`   [${q}] code ${p.code}`); break; }
      totalPages = p.data.pages || 1;
      for (const r of p.data.records || []) {
        const path = String(r.url || '');
        if (!path) continue;
        out.push({
          title: String(r.title || '').trim(),
          url: `https://www.ggzy.gov.cn${path.replace('/html/a/', '/html/b/')}`,
          date: String(r.publishTime || '').slice(0, 10).replace(/\//g, '-'),
          platform: r.transactionSourcesPlatformText || r.provinceText || '国家级',
          region: r.provinceText || '待核实',
        });
      }
    } catch (e) { console.log(`   [${q}] ${e.message}`); break; }
    await sleep(1200);
  }
  return out;
}

const KW_FILTER = /干选|选矸|分选|煤矸|TDS|XRT|智选/i;
const added = [], enriched = [];

for (const { q, proj } of QUERIES) {
  console.log(`\n>> 搜索 [${q}] （${proj}）`);
  const hits = await searchGgzy(q);
  const fresh = hits.filter(h => !known.has(normUrl(h.url)) && KW_FILTER.test(h.title));
  console.log(`   命中 ${hits.length} 条，其中新 ${fresh.length} 条`);
  for (const h of fresh.slice(0, 8)) {
    known.add(normUrl(h.url));
    const bid = classify(h.title);
    console.log(`   + [${bid}] ${h.title.slice(0, 46)} | ${h.date}`);
    // 抓详情抽金额
    let amount = '未披露', amountNote = '', buyer = null, winner = null, evidence = '';
    const res = await fetchSolid(h.url, { retries: 2, minBody: 400 });
    if (res.ok) {
      const a = extractAmount(res.html, res.body, bid);
      if (a && a.amount) { amount = a.amount; amountNote = `抽取方式:${a.source}`; }
      else amountNote = '公告正文确无金额信息';
      winner = extractWinnerName(res.html, res.body);
      buyer = extractBuyerName(res.body);
      evidence = res.body.slice(0, 300);
    } else {
      amountNote = `详情页不可达(${res.err})`;
    }
    added.push({
      title: h.title, url: h.url, date: h.date, publishDate: h.date,
      bid, bidStatus: bid,
      line: '智能干选', competitor: winner || '待核实', buyer: buyer || undefined,
      amount, amountNote: amount === '未披露' ? amountNote : undefined,
      amountSrc: amount !== '未披露' ? amountNote : undefined,
      source: `全国公共资源交易平台（${h.platform}）· 深挖交叉检索`,
      confidence: '高', evidence,
      digQuery: q, digProj: proj,
    });
    if (amount !== '未披露') { enriched.push({ proj, title: h.title.slice(0, 40), amount }); console.log(`     ★ 金额: ${amount}`); }
    await sleep(1500);
  }
}

data.push(...added);
writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`\n==== 深挖完成 ====`);
console.log(`新增公告: ${added.length} 条 -> flat 共 ${data.length} 条`);
console.log(`带金额的新公告: ${enriched.length} 条`);
enriched.forEach(e => console.log(`  ${e.amount.padEnd(12)} ${e.proj} | ${e.title}`));
