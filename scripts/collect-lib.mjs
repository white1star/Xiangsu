// 竞品公开情报采集库：纯函数 + 平台适配器。
// 范围：XRT 矿石智能分选设备、煤炭智能干选设备的招采信息（2026-01-01 起）。
// 铁律：不绕过登录/验证码/付费墙；金额与供应商只取公告原文，缺失填“未披露”。

export const MINIMUM_PUBLISH_DATE = '2026-01-01';
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Pixel-Intelligence-Monitor/2.0';

const GLOBAL_EXCLUDES = [
  /唐山像素/,
  /展会|博览会|论坛|峰会|宣传|品牌发布/,
  /旋转磁场|磁场干选|磁选机采购/,
  /带式输送机|胶带输送机|皮带输送机/,
];
const ORE_PATTERN = /(?<![A-Za-z0-9])XRT(?![A-Za-z0-9])|X\s*射线[^，。]{0,6}(分选|拣选|智能)|射线(智能)?分选/;
const COAL_PATTERN = /干选/;
const GENERIC_SORT_PATTERN = /智能(分选|拣选|选矸)/;
const MINING_CONTEXT = /矿|煤|选煤|洗选|矸|选厂|选矿/;
const GENERIC_BLOCKLIST = /垃圾|果蔬|茶叶|种子|塑料|快递|包裹|细胞|医疗/;

export function normalizeDate(raw) {
  if (!raw) return null;
  const match = String(raw).match(/(20\d{2})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function classifyLine(text) {
  if (!text) return null;
  if (GLOBAL_EXCLUDES.some(pattern => pattern.test(text))) return null;
  if (ORE_PATTERN.test(text)) return 'XRT矿石分选设备';
  if (COAL_PATTERN.test(text)) return '煤炭智能干选设备';
  if (GENERIC_SORT_PATTERN.test(text)) {
    if (GENERIC_BLOCKLIST.test(text)) return null;
    if (MINING_CONTEXT.test(text)) return /煤|矸|洗选|选煤/.test(text) ? '煤炭智能干选设备' : 'XRT矿石分选设备';
  }
  return null;
}

export function mapBidStatus(title, typeText = '') {
  const text = `${title} ${typeText}`;
  if (/流标|废标|终止|暂停|异常公告|撤销/.test(title)) return null;
  if (/招标文件|资格预审文件|澄清|答疑|开标记录|开标一览/.test(title)) return null;
  if (/候选人/.test(text)) return '中标候选人';
  if (/中标(结果|公告|公示)|成交(结果|公告|公示)|结果(公示|公告)|直接采购[^，。]{0,12}公示|单一来源[^，。]{0,12}(公示|结果)/.test(text)) return '已中标';
  if (/招标|采购公告|询价|询比|竞争性谈判|竞价|磋商|比选|征集/.test(text)) return '招标公告';
  return null;
}

export function extractAmount(text) {
  if (!text) return null;
  // [正则, 单位捕获组索引]；单位组缺失时按“元”处理。表格版式的宽松规则要求金额≥4位数字，避免误抓工期/得分。
  const patterns = [
    [/(?:中标|成交|合同|报价|投标)[^。；：\n]{0,14}?(?:价格?|金额|总价)[（(]?[^：:为\d]{0,8}[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元)/, 2],
    [/(?:中标|成交)价[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元)/, 2],
    [/小写[：:\s]*[（(]?\s*(?:人民币|￥|¥)?\s*([\d,，]{4,}(?:\.\d+)?)\s*[（(]?\s*元/, null],
    [/投标报价[（(]?元?[）)]?\s*[：:]?\s*([\d,，]{4,}(?:\.\d+)?)\s*元/, null],
    [/(?:中标|成交)(?:价格|金额)[\s\S]{0,160}?([\d,，]{4,}(?:\.\d{1,4})?)\s*元/, null],
  ];
  for (const [pattern, unitIndex] of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1].replace(/[,，]/g, ''));
    if (!Number.isFinite(value) || value <= 0) continue;
    const unit = unitIndex ? match[unitIndex] : '元';
    if (unit === '元' && value < 10000) continue;
    const wan = unit === '万元' ? value : value / 10000;
    return { display: `${wan.toFixed(2)}万元`, raw: match[0].slice(0, 80) };
  }
  return null;
}

export function extractWinner(text) {
  if (!text) return null;
  const patterns = [
    /(?:第一(?:中标)?候选人|中标候选人1|候选人一)[^：:]{0,10}[：:名称]*\s*([^，。；、：:\s<]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /(?:中标(?:单位|人|供应商)|成交(?:单位|人|供应商)|供应商名称)[（(]?[^：:）)]{0,8}[）)]?[：:为]\s*([^，。；、：:\s<]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /(?:中标|成交)(?:单位|人|供应商)(?:名称)?\s+([^\s，。；、：:<]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /第一名\s*(?:单位名称)?\s*[：:]?\s*([^\s，。；、：:<]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /(?:排序|名次)[\s\S]{0,120}?\b0*1\s+([^\s，。；、：:<\d]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /([^\s，。；、：:<]{4,42}?(?:公司|集团|研究院|研究所|中心|合伙企业))\s+(?:[\u4e00-\u9fa5]{2,4}\s+)?[\d,，]+(?:\.\d+)?\s*(?:万元|元)/,
  ];
  const hasResultContext = /中标|成交|候选人/.test(text);
  for (const pattern of patterns) {
    if (!hasResultContext) break;
    const match = text.match(pattern);
    if (!match) continue;
    const name = match[1]
      .replace(/^(?:中标候选人|中标人|中标单位|成交供应商|供应商|单位)?名称[*＊：:]?/, '')
      .replace(/^[*＊·、]+/, '');
    if (name.length >= 4) return name;
  }
  return null;
}

export function buildWindow(mode, today = new Date()) {
  const end = today.toISOString().slice(0, 10);
  if (mode === 'backfill') return { from: MINIMUM_PUBLISH_DATE, to: end };
  const begin = new Date(today.getTime() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return { from: begin < MINIMUM_PUBLISH_DATE ? MINIMUM_PUBLISH_DATE : begin, to: end };
}

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptEvidence(text, maxLength = 220) {
  if (!text) return '';
  const anchors = ['中标候选人', '中标单位', '中标人', '成交供应商', '中标价格', '成交金额', '中标金额'];
  for (const anchor of anchors) {
    const idx = text.indexOf(anchor);
    if (idx >= 0) return text.slice(Math.max(0, idx - 30), idx + maxLength - 30).trim();
  }
  return text.slice(0, maxLength).trim();
}

export function extractAnchors(html, baseUrl) {
  const anchors = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!title || title.length < 8) continue;
    let url = null;
    try { url = new URL(match[1], baseUrl).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    const context = html.slice(Math.max(0, match.index - 260), match.index + match[0].length + 260);
    anchors.push({ title, url, date: normalizeDate(context.match(/20\d{2}[-/.年]\s*\d{1,2}[-/.月]\s*\d{1,2}/)?.[0]) });
  }
  return anchors;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

function makeCandidate({ title, url, source, publishDate, typeText = '', region, sourceAuthority }) {
  const line = classifyLine(title);
  const bidStatus = mapBidStatus(title, typeText);
  return { title, url, source, publishDate, line, bidStatus, region: region || '待核实', sourceAuthority };
}

async function enrichFromOfficialDetail(candidate, detailUrl) {
  try {
    const { status, text } = await fetchText(detailUrl, { timeout: 25000 });
    if (status !== 200 || text.length < 500) return candidate;
    const body = htmlToText(text);
    candidate.evidence = excerptEvidence(body);
    candidate.evidenceCapturedAt = new Date().toISOString();
    // 金额与供应商只在结果类公告中提取，避免把招标阶段的控制价/保证金误当成交金额。
    if (candidate.bidStatus === '已中标' || candidate.bidStatus === '中标候选人') {
      const amount = extractAmount(body);
      const winner = extractWinner(body);
      if (amount) candidate.amount = amount.display;
      if (winner) candidate.competitor = candidate.bidStatus === '中标候选人' ? `${winner}（第一候选人）` : winner;
    }
    return candidate;
  } catch {
    return candidate;
  }
}

// —— 适配器：全国公共资源交易平台官方检索接口（聚合各省级平台） ——
export async function runGgzyApiAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 3;
  const maxDetails = limits.maxDetails ?? 40;
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  for (const keyword of rule.keywords) {
    let page = 1;
    let totalPages = 1;
    while (page <= Math.min(maxPages, totalPages)) {
      const form = new URLSearchParams({ DEAL_TIME: '06', TIMEBEGIN: window.from, TIMEEND: window.to, FINDTXT: keyword, PAGENUMBER: String(page) });
      const { status, text } = await fetchText(rule.searchEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://www.ggzy.gov.cn/deal/dealList.html' },
        body: form.toString(),
      });
      if (status !== 200) throw new Error(`检索接口 HTTP ${status}`);
      const payload = JSON.parse(text);
      if (payload.code === 829) throw new Error('触发平台验证码限流，本次未完成检索');
      if (payload.code !== 200) throw new Error(`检索接口返回 code=${payload.code} ${payload.message || ''}`);
      result.pagesScanned += 1;
      totalPages = payload.data.pages || 1;
      for (const record of payload.data.records || []) {
        const path = String(record.url || '');
        if (!path || seen.has(path)) continue;
        seen.add(path);
        result.discovered += 1;
        const candidate = makeCandidate({
          title: record.title,
          url: `https://www.ggzy.gov.cn${path.replace('/html/a/', '/html/b/')}`,
          source: `全国公共资源交易平台（${record.transactionSourcesPlatformText || record.provinceText || '国家级'}）`,
          publishDate: normalizeDate(record.publishTime),
          typeText: record.informationTypeText || '',
          region: record.provinceText || '待核实',
          sourceAuthority: 'official',
        });
        result.candidates.push(candidate);
      }
      page += 1;
      await sleep(900);
    }
    await sleep(600);
  }
  let enriched = 0;
  for (const candidate of result.candidates) {
    if (!candidate.line || !candidate.bidStatus) continue;
    if (enriched >= maxDetails) { result.notes.push('已达单次详情抓取上限，剩余候选下次运行继续'); break; }
    await enrichFromOfficialDetail(candidate, candidate.url);
    enriched += 1;
    await sleep(700);
  }
  return result;
}

// —— 适配器：官方栏目 HTML 列表（支持分页模板） ——
export async function runHtmlListAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 2;
  const maxDetails = limits.maxDetails ?? 20;
  const keyword = new RegExp(rule.keywords.join('|'), 'i');
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const url = page === 1 ? rule.listingUrl : rule.pageTemplate.replace('{n}', String(page));
    let response;
    try { response = await fetchText(url); } catch (error) {
      if (page === 1) throw error;
      result.notes.push(`第${page}页抓取失败：${error.message}`); break;
    }
    if (response.status === 404) { if (page === 1) throw new Error('列表页 404'); break; }
    if (response.status !== 200) { if (page === 1) throw new Error(`列表页 HTTP ${response.status}`); break; }
    result.pagesScanned += 1;
    for (const anchor of extractAnchors(response.text, url)) {
      if (!keyword.test(anchor.title) || seen.has(anchor.url)) continue;
      seen.add(anchor.url);
      result.discovered += 1;
      result.candidates.push(makeCandidate({
        title: anchor.title, url: anchor.url, source: rule.name,
        publishDate: anchor.date, region: rule.defaultRegion, sourceAuthority: rule.sourceAuthority || 'official',
      }));
    }
    await sleep(800);
  }
  let enriched = 0;
  for (const candidate of result.candidates) {
    if (!candidate.line || !candidate.bidStatus || candidate.sourceAuthority !== 'official') continue;
    if (enriched >= maxDetails) break;
    await enrichFromOfficialDetail(candidate, candidate.url);
    enriched += 1;
    await sleep(600);
  }
  return result;
}

// —— 适配器：单页浅扫（首页动态渲染平台的可及部分；覆盖有限，如实标注） ——
export async function runHomeScanAdapter(rule) {
  const keyword = new RegExp(rule.keywords.join('|'), 'i');
  const { status, text } = await fetchText(rule.listingUrl);
  if (status !== 200) throw new Error(`入口页 HTTP ${status}`);
  if (text.length < 5000) throw new Error(`入口页内容过短（${text.length} 字节），疑似被拦截`);
  const result = { pagesScanned: 1, discovered: 0, candidates: [], notes: [rule.coverNote || '仅能扫描入口页可见公告，栏目深页需 JS 渲染，覆盖有限'] };
  const seen = new Set();
  for (const anchor of extractAnchors(text, rule.listingUrl)) {
    if (!keyword.test(anchor.title) || seen.has(anchor.url)) continue;
    seen.add(anchor.url);
    result.discovered += 1;
    result.candidates.push(makeCandidate({
      title: anchor.title, url: anchor.url, source: rule.name,
      publishDate: anchor.date, region: rule.defaultRegion, sourceAuthority: rule.sourceAuthority || 'official',
    }));
  }
  for (const candidate of result.candidates.slice(0, 10)) {
    if (!candidate.line || !candidate.bidStatus || candidate.sourceAuthority !== 'official') continue;
    await enrichFromOfficialDetail(candidate, candidate.url);
    await sleep(600);
  }
  return result;
}

// —— 适配器：反爬探测（不绕过；被拦截时如实记失败原因） ——
export async function runProbeAdapter(rule) {
  const { status, text } = await fetchText(rule.listingUrl);
  if (/频繁访问|访问验证|verify|captcha|滑动验证/i.test(text) || text.length < 3200) {
    throw new Error('平台反爬拦截（频繁访问/验证提示），未绕过，等待下次重试');
  }
  if (status !== 200) throw new Error(`HTTP ${status}`);
  const keyword = new RegExp(rule.keywords.join('|'), 'i');
  const result = { pagesScanned: 1, discovered: 0, candidates: [], notes: [] };
  for (const anchor of extractAnchors(text, rule.listingUrl)) {
    if (!keyword.test(anchor.title)) continue;
    result.discovered += 1;
    result.candidates.push(makeCandidate({ title: anchor.title, url: anchor.url, source: rule.name, publishDate: anchor.date, sourceAuthority: rule.sourceAuthority || 'official' }));
  }
  return result;
}

export const ADAPTERS = {
  'ggzy-api': runGgzyApiAdapter,
  'html-list': runHtmlListAdapter,
  'home-scan': runHomeScanAdapter,
  probe: runProbeAdapter,
};
