// scrape33.mjs —— 对 33 个可匿名平台做完整抓取 + 修正现有台账“未披露”金额
// 铁律：不绕过登录/验证码/付费墙；金额只取公告原文，缺失填“未披露”。
import { readFileSync, writeFileSync } from 'node:fs';
import {
  classifyLine, mapBidStatus, normalizeDate, htmlToText, excerptEvidence,
  extractAnchors, extractWinner, extractBuyer, extractProcurement, extractBidOpenDate,
  extractBudget, USER_AGENT,
} from './collect-lib.mjs';

// 本地 fetch/sleep（collect-lib 的 fetchText/sleep 未导出）
async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, ...(options.headers || {}) },
    method: options.method || 'GET',
    body: options.body,
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeout || 30000),
  });
  const text = await response.text();
  return { status: response.status, text, ok: response.ok };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const DATA = 'src/data/intelligence.json';
const OUT = 'src/data/intelligence.new.json';
const REPORT = 'scripts/_scan_report.txt';

// ---------- 金额抽取：用户要求“直接拿第一个金额”，优先中标价/报价/控制价 ----------
function extractFirstAmount(text) {
  if (!text) return null;
  const t = text.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const hints = [];
  const labeled = [
    { kind: 'bid', re: /中\s*标\s*(?:价\s*格|金\s*额|价|人)[^0-9]{0,60}?[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'bid', re: /成\s*交\s*(?:价\s*格|金\s*额|价|人|供应)[^0-9]{0,60}?[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'bid', re: /投\s*标\s*报\s*价[^0-9]{0,12}?[：:]?\s*([\d,，]{4,}(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'bid', re: /报\s*价[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]{4,}(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'ctrl', re: /招\s*标\s*控\s*制\s*价[^0-9]{0,18}?[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'ctrl', re: /控\s*制\s*价[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]{4,}(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'ctrl', re: /最\s*高\s*(?:投\s*标\s*)?限\s*价[^0-9]{0,14}?[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元|万)?/g },
    { kind: 'ctrl', re: /预\s*算(?:金\s*额|价)?[^0-9]{0,14}?[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元|万)?/g },
  ];
  for (const L of labeled) for (const m of t.matchAll(L.re)) {
    const v = Number(m[1].replace(/[,，]/g, ''));
    if (v > 0) hints.push({ pos: m.index, kind: L.kind, v, unit: m[2] || null, raw: m[0].slice(0, 40) });
  }
  for (const m of t.matchAll(/([\d,，]{4,}(?:\.\d{1,4})?)\s*(万元|元|万)/g)) {
    const v = Number(m[1].replace(/[,，]/g, ''));
    if (v > 0) hints.push({ pos: m.index, kind: 'standalone', v, unit: m[2], raw: m[0].slice(0, 40) });
  }
  const toWan = h => h.unit === '元' ? h.v / 10000 : (h.unit === '万' ? h.v : (h.v >= 10000 ? h.v / 10000 : h.v));
  const valid = hints.filter(h => {
    if (h.unit === '元' && h.v < 10000) return false;
    if (!h.unit && h.v < 10000) return false; // 小数字且无单位（编号/天数）跳过
    return true;
  });
  if (!valid.length) return null;
  const rank = { bid: 0, ctrl: 1, standalone: 2 };
  valid.sort((a, b) => rank[a.kind] - rank[b.kind] || a.pos - b.pos);
  const best = valid[0];
  return { display: `${toWan(best).toFixed(2)}万元`, raw: best.raw, kind: best.kind };
}

// ---------- 详情富化（带重试，克服 ggzy 偶发空壳） ----------
async function enrich(candidate) {
  let lastBody = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { status, text } = await fetchText(candidate.url, { timeout: 25000 });
      if (status !== 200) break;
      const body = htmlToText(text);
      lastBody = body;
      if (body.length < 800 && attempt < 2) { await sleep(1500); continue; }
      candidate.evidence = excerptEvidence(body);
      candidate.evidenceCapturedAt = new Date().toISOString();
      const fa = extractFirstAmount(body);
      if (fa) candidate.amount = fa.display;
      if (/无文本内容|请查阅pdf|点击下载.*pdf|附件下载/i.test(body) && !fa) candidate.amount = '未披露(原文PDF)';
      const w = extractWinner(body);
      if (w) candidate.competitor = candidate.bidStatus === '中标候选人' ? `${w}（第一候选人）` : w;
      const b = extractBuyer(body); if (b) candidate.buyer = b;
      const p = extractProcurement(body); if (p) candidate.procurement = p;
      const bd = extractBidOpenDate(body); if (bd) candidate.bidOpenDate = bd;
      const bg = extractBudget(body); if (bg) candidate.budget = bg.display;
      break;
    } catch { /* retry */ }
  }
  return candidate;
}

function makeCandidate({ title, url, source, publishDate, typeText = '', region, sourceAuthority }) {
  const line = classifyLine(title);
  const bidStatus = mapBidStatus(title, typeText);
  return { title, url, source, publishDate, line, bidStatus, region: region || '待核实', sourceAuthority, amount: '未披露', confidence: '高' };
}

// 归一化 URL 作为去重键（ggzy 两种前缀统一）
function urlKey(u) {
  try {
    const p = new URL(u);
    let path = p.pathname.replace(/^\/information\/deal/, '').replace(/^\/html\/b/, '/html/b');
    return (p.host + path).replace(/\/$/, '');
  } catch { return u; }
}

// ---------- 各适配器 ----------
async function runGgzy(rule, window) {
  const out = { discovered: 0, candidates: [], notes: [] };
  for (const keyword of rule.keywords) {
    let totalPages = 1, page = 1;
    while (page <= rule.maxPages && page <= totalPages) {
      const form = new URLSearchParams({ DEAL_TIME: '13', TIMEBEGIN: window.from, TIMEEND: window.to, FINDTXT: keyword, PAGENUMBER: String(page) });
      try {
        const { status, text } = await fetchText(rule.searchEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://www.ggzy.gov.cn/deal/dealList.html' }, body: form.toString() });
        if (status !== 200) { out.notes.push(`[${keyword}] HTTP ${status}`); break; }
        const p = JSON.parse(text);
        if (p.code === 829) { out.notes.push(`[${keyword}] 触发验证码限流，暂停该词`); await sleep(30000); break; }
        if (p.code !== 200) { out.notes.push(`[${keyword}] code ${p.code}`); break; }
        totalPages = p.data.pages || 1;
        for (const r of p.data.records || []) {
          const path = String(r.url || '');
          if (!path) continue;
          const url = `https://www.ggzy.gov.cn${path.replace('/html/a/', '/html/b/')}`;
          const c = makeCandidate({ title: r.title, url, source: `全国公共资源交易平台（${r.transactionSourcesPlatformText || r.provinceText || '国家级'}）`, publishDate: normalizeDate(r.publishTime), typeText: r.informationTypeText || '', region: r.provinceText || '待核实', sourceAuthority: 'official' });
          if (c.line && c.bidStatus) { out.discovered++; out.candidates.push(c); }
        }
      } catch (e) { out.notes.push(`[${keyword}] ${e.message}`); break; }
      page++; await sleep(900);
    }
    await sleep(500);
  }
  return out;
}

async function runHtmlList(rule) {
  const kw = new RegExp(rule.keywords.join('|'), 'i');
  const out = { discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  for (let page = 1; page <= rule.maxPages; page++) {
    const url = page === 1 ? rule.listingUrl : (rule.buildUrl ? rule.buildUrl(page) : rule.pageTemplate.replace('{n}', String(page)));
    let res;
    try { res = await fetchText(url); }
    catch (e) { if (page === 1) out.notes.push(`首頁失败 ${e.message}`); else break; continue; }
    if (res.status === 404) { if (page === 1) out.notes.push('列表404'); break; }
    if (res.status !== 200) { if (page === 1) out.notes.push(`列表HTTP ${res.status}`); break; }
    for (const a of extractAnchors(res.text, url)) {
      if (!kw.test(a.title) || seen.has(a.url)) continue;
      seen.add(a.url);
      const c = makeCandidate({ title: a.title, url: a.url, source: rule.name, publishDate: a.date, region: rule.defaultRegion, sourceAuthority: rule.sourceAuthority || 'official' });
      if (c.line && c.bidStatus) { out.discovered++; out.candidates.push(c); }
    }
    await sleep(700);
  }
  return out;
}

// 通用检索型（聚合站/SPA）：尽力抓，空壳则如实记录
async function runSearchList(rule) {
  const kw = new RegExp(rule.keywords.join('|'), 'i');
  const out = { discovered: 0, candidates: [], notes: [rule.coverNote || ''] };
  const seen = new Set();
  for (const base of rule.urls) {
    let res;
    try { res = await fetchText(base, { headers: rule.headers || {} }); }
    catch (e) { out.notes.push(`${base} 失败 ${e.message}`); continue; }
    const body = htmlToText(res.text);
    if (body.length < 1200) { out.notes.push(`${base} 内容过短(${body.length})，疑似SPA/反爬空壳`); continue; }
    for (const a of extractAnchors(res.text, base)) {
      if (!kw.test(a.title) || seen.has(a.url)) continue;
      seen.add(a.url);
      const c = makeCandidate({ title: a.title, url: a.url, source: rule.name, publishDate: a.date, sourceAuthority: 'aggregator' });
      if (c.line && c.bidStatus) { out.discovered++; out.candidates.push(c); }
    }
  }
  return out;
}

// ---------- 平台清单（33 个可匿名） ----------
const GGZY_KW = ['智能干选', '干选机', 'XRT', '智能分选', 'X射线分选', '智能选矸', '选矸', '矿石分选', '光电分选', '干选系统', 'XRT分选', '射线智能分选', '矿石智能分选', '光电分选机', 'X射线智能分选', '干选设备', '智能干选系统'];

const sources = [
  { id: 'national-ggzy', name: '全国公共资源交易平台(聚合16省+国家+央企)', adapter: 'ggzy', keywords: GGZY_KW, maxPages: 5,
    searchEndpoint: 'https://www.ggzy.gov.cn/information/pubTradingInfo/getTradList' },
  // —— 业主/央企自有平台（HTML 列表，可匿名浏览） ——
  { id: 'ccteg-hw', platformId: 'ccteg', name: '中国煤科电子采购平台(货物结果)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选机'], maxPages: 6,
    listingUrl: 'https://cg.ccteg.cn/cms/channel/ywgg4hw/index.htm', pageTemplate: 'https://cg.ccteg.cn/cms/channel/ywgg4hw/index_{n}.htm', defaultRegion: '煤炭智能干选设备' },
  { id: 'ccteg-qb', platformId: 'ccteg', name: '中国煤科电子采购平台(全部结果)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选机'], maxPages: 8,
    listingUrl: 'https://cg.ccteg.cn/cms/channel/ywgg4qb/index.htm', pageTemplate: 'https://cg.ccteg.cn/cms/channel/ywgg4qb/index_{n}.htm', defaultRegion: '煤炭智能干选设备' },
  { id: 'chnenergy-zbgg', platformId: 'chnenergy', name: '国能e招(招标公告)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选机', '智能选矸', '选矸'], maxPages: 3,
    listingUrl: 'https://www.chnenergybidding.com.cn/bidweb/001/001002/moreinfo.html', pageTemplate: 'https://www.chnenergybidding.com.cn/bidweb/001/001002/moreinfo_{n}.html', defaultRegion: '央企招投标' },
  { id: 'chnenergy-zbhx', platformId: 'chnenergy', name: '国能e招(中标候选/结果)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选机', '智能选矸', '选矸'], maxPages: 3,
    listingUrl: 'https://www.chnenergybidding.com.cn/bidweb/001/001005/moreinfo.html', pageTemplate: 'https://www.chnenergybidding.com.cn/bidweb/001/001005/moreinfo_{n}.html', defaultRegion: '央企招投标' },
  { id: 'zmzb-hw', platformId: 'zmzb', name: '中煤招标与采购网(货物)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选机', '智能选矸', '选矸'], maxPages: 3,
    listingUrl: 'https://www.zmzb.com/cms/channel/ywgg1hw/index.htm', pageTemplate: 'https://www.zmzb.com/cms/channel/ywgg1hw/index_{n}.htm', defaultRegion: '煤炭智能干选设备' },
  { id: 'gsei-zb', platformId: 'gsei', name: '甘肃经济信息网(中标结果)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 6,
    listingUrl: 'https://www.gsei.com.cn/html/1337/index.html', pageTemplate: 'https://www.gsei.com.cn/html/1337/list_{n}.html', defaultRegion: '甘肃' },
  { id: 'gsei-zbgg', platformId: 'gsei', name: '甘肃经济信息网(招标公告)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 4,
    listingUrl: 'https://www.gsei.com.cn/html/1336/index.html', pageTemplate: 'https://www.gsei.com.cn/html/1336/list_{n}.html', defaultRegion: '甘肃' },
  { id: 'qin-yuan-zbgg', platformId: 'qin-yuan', name: '秦源招标(陕煤·招标公告)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 3,
    listingUrl: 'https://qyzb.shccmg.com/cms/default/webfile/1ywgg/index.html', pageTemplate: 'https://qyzb.shccmg.com/cms/default/webfile/1ywgg/index_{n}.html', defaultRegion: '陕西省' },
  { id: 'qin-yuan-zbgs', platformId: 'qin-yuan', name: '秦源招标(陕煤·中标公示)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 3,
    listingUrl: 'https://qyzb.shccmg.com/cms/default/webfile/zbgs/index.html', pageTemplate: 'https://qyzb.shccmg.com/cms/default/webfile/zbgs/index_{n}.html', defaultRegion: '陕西省' },
  { id: 'qin-yuan-zbgg2', platformId: 'qin-yuan', name: '秦源招标(陕煤·中标公告)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 3,
    listingUrl: 'https://qyzb.shccmg.com/cms/default/webfile/zbgg/index.html', pageTemplate: 'https://qyzb.shccmg.com/cms/default/webfile/zbgg/index_{n}.html', defaultRegion: '陕西省' },
  { id: 'sdny-inquiry', platformId: 'shandong-inquiry', name: '山东能源询比价平台', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 5,
    listingUrl: 'https://snxy.minegoods.com/sdnyfzcms/category/bulletinList.html?dates=300&categoryId=16&page=1',
    buildUrl: p => `https://snxy.minegoods.com/sdnyfzcms/category/bulletinList.html?dates=300&categoryId=16&page=${p}`, defaultRegion: '山东省' },
  { id: 'sdny-inquiry2', platformId: 'shandong-inquiry', name: '山东能源询比价平台(竞价/结果)', adapter: 'html', keywords: ['干选', '智能分选', 'XRT', '分选'], maxPages: 5,
    listingUrl: 'https://snxy.minegoods.com/sdnyfzcms/category/bulletinList.html?dates=300&categoryId=13&page=1',
    buildUrl: p => `https://snxy.minegoods.com/sdnyfzcms/category/bulletinList.html?dates=300&categoryId=13&page=${p}`, defaultRegion: '山东省' },
  // —— 聚合/检索站（SPA/反爬，尽力抓，如实记录） ——
  { id: 'jianyu', platformId: 'jianyu', name: '剑鱼标讯', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://www.jianyu360.cn/list/stype/ZBGG.html', 'https://www.jianyu360.cn/list/keywords/ZHINENGGANXUAN.html'], coverNote: '招标/中标可匿名浏览；SPA动态加载，空壳则记录' },
  { id: 'bidcenter', platformId: 'bidcenter', name: '中国招标网', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://www.bidcenter.com.cn/zbpage-1-1.html', 'https://www.bidcenter.com.cn/zbpage-4-1.html'], coverNote: '公告可匿名浏览；高级检索受会员限制' },
  { id: 'ebnew', platformId: 'ebnew', name: '必联网', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://ss.ebnew.com/tradingSearch/rangeType-2.html'], coverNote: '公告可匿名浏览；深度检索需登录' },
  { id: 'yfbzb', platformId: 'yfbzb', name: '乙方宝', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://www.yfbzb.com/search/invitedBidSearch?defaultSearch=true&keyword=%E6%99%BA%E8%83%BD%E5%B9%B2%E9%80%89'], coverNote: '招标信息可匿名检索；完整详情需登录' },
  { id: 'ceb-public', platformId: 'ceb-public', name: '中国招标投标公共服务平台', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://www.cebpubservice.com/web/search?keyword=%E6%99%BA%E8%83%BD%E5%B9%B2%E9%80%89&pageNo=1'], coverNote: '官方公告服务平台；以原公告链接为最终证据' },
  { id: 'ccgp', platformId: 'ccgp', name: '中国政府采购网', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://search.ccgp.gov.cn/bxsearch?searchtype=1&page_index=1&kw=%E6%99%BA%E8%83%BD%E5%B9%B2%E9%80%89'], coverNote: '对非浏览器流量返回“频繁访问”拦截；不绕过' },
  { id: 'cgs', platformId: 'cgs-procurement', name: '中国地质调查局政府采购', adapter: 'search', keywords: ['智能干选', 'XRT', '分选', '选矿'],
    urls: ['https://www.cgs.gov.cn/tzgg/zfcg_5637/'], coverNote: 'XRT矿石分选设备官方补充来源' },
  { id: 'mtzbw', platformId: 'mtzbw', name: '中国煤炭招标网', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://www.mtzbw.cn/'], coverNote: '行业聚合站，只产出待复核线索，须反查官方原文' },
  { id: 'xunbiaobao', platformId: 'xunbiaobao', name: '寻标宝', adapter: 'search', keywords: ['智能干选', '干选机', 'XRT', '智能分选'],
    urls: ['https://xunbiaobao.baidu.com/s?keyword=%E6%99%BA%E8%83%BD%E5%B9%B2%E9%80%89'], coverNote: '招标信息可匿名检索；订阅和完整详情需登录' },
  // 省级公共资源（16 个）由 national-ggzy 聚合器统一覆盖，此处显式登记以保证“完整、不遗漏”
  ...['shanxi-ggzy','shaanxi-ggzy','inner-mongolia-ggzy','xinjiang-ggzy','anhui-ggzy','shandong-ggzy','henan-ggzy','hebei-ggzy','guizhou-ggzy','gansu-ggzy','ningxia-ggzy','heilongjiang-ggzy','yunnan-ggzy','sichuan-ggzy','liaoning-ggzy','qinghai-ggzy'].map(id => ({
    id, platformId: id, name: id, adapter: 'aggregated', keywords: [], maxPages: 0, coverNote: '由全国公共资源交易平台聚合器统一覆盖（同一官方数据源）',
  })),
];

// ---------- 主流程 ----------
const window = { from: '2026-01-01', to: '2026-07-31' };
const allNew = [];
const perPlatform = [];
let fixCount = 0, fixSkipped = 0;

// 0) 先修现有台账金额
let existing = JSON.parse(readFileSync(DATA, 'utf8'));
console.log(`现有台账 ${existing.length} 条，开始修正“未披露”金额…`);
for (const rec of existing) {
  if (rec.amount && rec.amount !== '未披露' && !/未披露/.test(rec.amount)) continue;
  // 先尝试从已存 evidence 抽
  let fa = rec.evidence ? extractFirstAmount(rec.evidence) : null;
  if (!fa && rec.url && !/无文本内容|请查阅pdf/i.test(rec.evidence || '')) {
    // 重新抓取详情
    try {
      const { status, text } = await fetchText(rec.url, { timeout: 25000 });
      if (status === 200) { const body = htmlToText(text); if (body.length >= 800) fa = extractFirstAmount(body); }
    } catch {}
  }
  if (fa) { rec.amount = fa.display; fixCount++; }
  else fixSkipped++;
}
console.log(`金额修正：${fixCount} 条补到真实金额，${fixSkipped} 条仍无（含PDF原文）。`);

// 1) 跑全部平台
for (const src of sources) {
  let res;
  const t0 = Date.now();
  try {
    if (src.adapter === 'ggzy') res = await runGgzy(src, window);
    else if (src.adapter === 'html') res = await runHtmlList(src);
    else if (src.adapter === 'search') res = await runSearchList(src);
    else { perPlatform.push({ id: src.id, name: src.name, discovered: '聚合覆盖', notes: [src.coverNote] }); continue; }
  } catch (e) { res = { discovered: 0, candidates: [], notes: ['异常:' + e.message] }; }
  // 富化每个候选
  for (const c of res.candidates) await enrich(c);
  // 记录
  perPlatform.push({ id: src.id, name: src.name, discovered: res.discovered, notes: res.notes });
  allNew.push(...res.candidates.map(c => ({ ...c, platformId: src.platformId, sourceAuthority: c.sourceAuthority })));
  console.log(`[${src.id}] 发现 ${res.discovered} 条（耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s） notes=${res.notes.slice(0,2).join('|')}`);
  await sleep(300);
}

// 2) 合并去重：以 urlKey 为主，标题+日期为辅
const map = new Map();
for (const rec of existing) map.set(urlKey(rec.url), { rec, key: urlKey(rec.url) });
// 也建一个 标题+日期 索引
const titleDate = new Map();
for (const rec of existing) titleDate.set((rec.title || '').slice(0, 30) + '|' + (rec.publishDate || ''), true);

let added = 0, amountUpdated = 0;
for (const c of allNew) {
  const key = urlKey(c.url);
  if (map.has(key)) {
    const cur = map.get(key).rec;
    // 现有金额未披露 / PDF，而新抓到真实金额 → 补
    if ((!/未披露/.test(cur.amount)) && cur.amount) {
      // 现有已真实，保留；但新抓若更全（有中标人）可补字段
    } else if (c.amount && !/未披露/.test(c.amount)) { cur.amount = c.amount; amountUpdated++; }
    if (!cur.competitor || /未披露/.test(cur.competitor)) cur.competitor = c.competitor || cur.competitor;
    if (!cur.buyer) cur.buyer = c.buyer || cur.buyer;
    if (!cur.procurement) cur.procurement = c.procurement || cur.procurement;
    if (!cur.bidOpenDate) cur.bidOpenDate = c.bidOpenDate || cur.bidOpenDate;
    if (!cur.budget) cur.budget = c.budget || cur.budget;
    continue;
  }
  const td = (c.title || '').slice(0, 30) + '|' + (c.publishDate || '');
  if (titleDate.has(td)) continue; // 同源不同URL去重
  // 新记录入库
  const rec = { ...c, confidence: '高' };
  if (!rec.id) rec.id = 'auto-' + Buffer.from(c.url).toString('base64').slice(0, 24);
  map.set(key, { rec, key });
  titleDate.set(td, true);
  added++;
}

const merged = [...map.values()].map(x => x.rec);
writeFileSync(OUT, JSON.stringify(merged, null, 2));
writeFileSync(REPORT, perPlatform.map(p => `${p.id}\t发现=${p.discovered ?? '-'}\t${p.notes.join(' ; ')}`).join('\n'));

console.log('\n===== 扫描报告 =====');
console.log(`现有修正金额: ${fixCount} 条`);
console.log(`新增记录: ${added} 条`);
console.log(`现有记录金额被补: ${amountUpdated} 条`);
console.log(`合并后台账总数: ${merged.length} 条`);
console.log('各平台:');
for (const p of perPlatform) console.log(`  - ${p.name}: ${p.discovered ?? '聚合覆盖'} | ${p.notes.slice(0, 1).join('')}`);
console.log(`\n输出: ${OUT}\n报告: ${REPORT}`);
