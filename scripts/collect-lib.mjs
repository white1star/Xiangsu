// 竞品公开情报采集库：纯函数 + 平台适配器。
// 范围：XRT 矿石智能分选设备、煤炭智能干选设备的招采信息（2026-01-01 起）。
// 铁律：不绕过登录/验证码/付费墙；金额与供应商只取公告原文，缺失填“未披露”。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MINIMUM_PUBLISH_DATE = '2026-01-01';
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Pixel-Intelligence-Monitor/2.0';

const GLOBAL_EXCLUDES = [
  /唐山像素/,
  /展会|博览会|论坛|峰会|宣传|品牌发布/,
  /旋转磁场|磁场干选|磁选机采购/,
  /带式输送机|胶带输送机|皮带输送机/,
];
const ORE_PATTERN = /(?<![A-Za-z0-9])XRT(?![A-Za-z0-9])|X\s*射线[^，。]{0,6}(分选|拣选|智能)|射线(智能)?分选|光电分选/;
const COAL_PATTERN = /干选|干法选煤|干法分选|干法提质|复合干选/;
const GENERIC_SORT_PATTERN = /智能[^，。；\s]{0,4}(分选|拣选|选矸)/;
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
    /(?:第一(?:中标)?候选人|中标候选人1|候选人一)[^：:]{0,10}[：:名称]*\s*([^，。；、：:\s<]{4,42}?(?:股份有限公司|有限公司|公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /(?:中标(?:单位|人|供应商)|成交(?:单位|人|供应商)|供应商名称)[（(]?[^：:）)]{0,8}[）)]?[：:为]\s*([^，。；、：:\s<]{4,42}?(?:股份有限公司|有限公司|公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /(?:中标|成交)(?:单位|人|供应商)(?:名称)?\s+([^\s，。；、：:<]{4,42}?(?:股份有限公司|有限公司|公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /第一名\s*(?:单位名称)?\s*[：:]?\s*([^\s，。；、：:<]{4,42}?(?:股份有限公司|有限公司|公司|集团|厂|研究院|研究所|中心|合伙企业))/,
    /(?:排序|名次)[\s\S]{0,120}?\b0*1\s+([^\s，。；、：:<\d]{4,42}?(?:股份有限公司|有限公司|公司|集团|厂|研究院|研究所|中心|合伙企业))/,
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
    // “集团/厂/研究院”等短后缀可能截断法定名称；若其后紧跟“有限公司”等则续接完整。
    const tail = text.slice((match.index ?? 0) + match[0].length);
    const continuation = tail.match(/^(?:有限公司|有限责任公司|股份有限公司)/);
    const fullName = continuation && /(?:集团|厂|中心|研究院|研究所|大学|学院)$/.test(name) ? name + continuation[0] : name;
    if (fullName.length >= 4) return fullName;
  }
  return null;
}

// 抽取招标阶段的预算/控制价/最高限价（与成交价区分，单独成字段）。
export function extractBudget(text) {
  if (!text) return null;
  const patterns = [
    [/(?:招标控制价|控制价|最高投标限价|最高限价|投标最高限价|拦标价)[^。；：\n]{0,16}?(?:价格?|金额|总价)?[（(]?[^：:为\d]{0,8}[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元)/, 2],
    [/(?:采购预算|预算金额|项目预算|预算价|预算)[^。；：\n]{0,12}?(?:价格?|金额|总价)?[（(]?[^：:为\d]{0,8}[：:为]?\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(万元|元)/, 2],
    [/(?:控制价|最高限价|预算)[：:为]\s*(?:人民币|￥|¥)?\s*([\d,，]{4,}(?:\.\d+)?)\s*(万元|元)/, 2],
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

// 抽取招标人/采购人/建设单位（招标公告中的采购方）。
export function extractBuyer(text) {
  if (!text) return null;
  const patterns = [
    /(?:招标人|采购人|建设单位)[^。；\n]{0,4}?[：:为]\s*([^，。；、\s<]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|局|矿|能源|煤业|矿业|有限责任公司|股份有限公司))/,
    /(招标人|采购人|建设单位)[^。；\n]{0,4}?\s*([^，。；、\s<]{4,42}?(?:公司|集团|厂|研究院|研究所|中心|局|矿|能源|煤业|矿业|有限责任公司|股份有限公司))/,
    /([^，。；、\s<]{4,42}?(?:招标有限责任公司|咨询有限公司|采购代理机构))/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const name = (match[2] || match[1]).replace(/^(?:招标人|采购人|建设单位)[*＊：:]?/, '').trim();
    if (name.length >= 4) return name;
  }
  return null;
}

// 抽取采购内容/设备型号/数量摘要（如“采购N台智能干选机”）。
export function extractProcurement(text) {
  if (!text) return null;
  const patterns = [
    /(?:采购内容|采购范围|招标范围|建设内容|项目内容)[^。；\n]{0,6}?[：:为]?\s*([^。；\n]{4,120}?(?:智能干选|干选机|XRT|分选机|选矸|分选系统|干选系统|干选设备)[^。；\n]{0,40})/,
    /([^。；\n]{0,30}?(?:智能干选|干选机|XRT|分选机|选矸|智能分选系统|干选系统)[^。；\n]{0,60})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const s = (match[1] || '').trim();
    if (s.length >= 6) return s.slice(0, 120);
  }
  return null;
}

// 从招标公告原文抽取"开标时间/开标日期"。优先"开标时间/开标日期"锚点，
// 兜底“投标/投标文件递交截止时间”。归一到 YYYY-MM-DD（忽略时分）。
export function extractBidOpenDate(text) {
  if (!text) return null;
  const decoded = text
    .replace(/&ensp;|&emsp;|&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;|&lsquo;|&rsquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
  const dateRe = /(20\d{2})[-/.年\s]\s*(\d{1,2})[-/.月\s]\s*(\d{1,2})/;
  const trySlice = slice => {
    const m = slice.match(dateRe);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
  };
  for (const anchor of ['开标时间', '开标日期']) {
    const i = decoded.indexOf(anchor);
    if (i >= 0) { const r = trySlice(decoded.slice(i, i + 40)); if (r) return r; }
  }
  const bi = decoded.indexOf('开标');
  if (bi >= 0) { const r = trySlice(decoded.slice(bi, bi + 40)); if (r) return r; }
  for (const anchor of ['递交截止时间', '投标截止时间', '投标文件递交截止时间', '递交截止', '截止时间']) {
    const i = decoded.indexOf(anchor);
    if (i >= 0) { const r = trySlice(decoded.slice(i, i + 40)); if (r) return r; }
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
  const anchors = ['中标候选人', '中标单位', '中标人', '成交供应商', '中标价格', '成交金额', '中标金额', '开标时间', '开标日期', '投标截止', '递交截止'];
  for (const anchor of anchors) {
    const idx = text.indexOf(anchor);
    if (idx >= 0) return text.slice(Math.max(0, idx - 30), idx + maxLength - 30).trim();
  }
  return text.slice(0, maxLength).trim();
}

export function extractAnchors(html, baseUrl) {
  const anchors = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/["']\s*[\w-]+\s*=\s*["'][^"']*["']\s*>/g, ' ') // 清除残缺标签属性残留（个别站点 a 标签未闭合）
      .replace(/&#x[e-fE-F][0-9a-fA-F]{3};/g, '') // 清除图标字体私有区实体（如 ccteg 的 &#xe638;）
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
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

// 按响应头 charset 解码（部分政企平台为 gb2312/gbk；fetch 默认按 UTF-8 会乱码）
function decodeBody(buffer, contentType) {
  const charset = (String(contentType || '').match(/charset=["']?([\w-]+)/i)?.[1] || 'utf-8').toLowerCase();
  const label = { 'gb2312': 'gb18030', 'gbk': 'gb18030', 'gb18030': 'gb18030', 'utf8': 'utf-8' }[charset] || charset;
  if (label === 'utf-8') return buffer.toString('utf8');
  try { return new TextDecoder(label).decode(buffer); } catch { return buffer.toString('utf8'); }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, ...(options.headers || {}) },
    method: options.method || 'GET',
    body: options.body,
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeout || 30000),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = decodeBody(buffer, response.headers.get('content-type'));
  return { status: response.status, text, ok: response.ok };
}

function makeCandidate({ title, url, source, publishDate, typeText = '', region, sourceAuthority }) {
  const line = classifyLine(title);
  const bidStatus = mapBidStatus(title, typeText);
  return { title, url, source, publishDate, line, bidStatus, region: region || '待核实', sourceAuthority };
}

// 用详情正文（公告原文纯文本）补全候选：证据摘录、金额/预算/采购人/采购内容/中标人/开标日期。
export function applyDetailBody(candidate, body) {
  candidate.evidence = excerptEvidence(body);
  candidate.evidenceCapturedAt = new Date().toISOString();
  // 无论招标/结果，都尽力抽取预算、采购人、采购内容，减少“未披露”。
  const amount = extractAmount(body);
  const budget = extractBudget(body);
  const buyer = extractBuyer(body);
  const procurement = extractProcurement(body);
  if (candidate.bidStatus === '已中标' || candidate.bidStatus === '中标候选人') {
    // 结果类优先填成交价；拿不到成交价但有控制价时回退，避免空着。
    if (amount) candidate.amount = amount.display;
    else if (budget) candidate.amount = budget.display;
    const winner = extractWinner(body);
    if (winner) candidate.competitor = candidate.bidStatus === '中标候选人' ? `${winner}（第一候选人）` : winner;
  } else if (candidate.bidStatus === '招标公告') {
    // 招标公告无成交价，金额填控制价/预算（若有），并抽取开标日期。
    if (amount) candidate.amount = amount.display;
    else if (budget) candidate.amount = budget.display;
    candidate.bidOpenDate = extractBidOpenDate(body) || null;
  }
  if (budget) candidate.budget = budget.display;
  if (buyer) candidate.buyer = buyer;
  if (procurement) candidate.procurement = procurement;
  return candidate;
}

export async function enrichFromOfficialDetail(candidate, detailUrl) {
  try {
    const { status, text } = await fetchText(detailUrl, { timeout: 25000 });
    if (status !== 200 || text.length < 500) return candidate;
    return applyDetailBody(candidate, htmlToText(text));
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
  // searchTemplate：按关键词逐个检索（模板 {kw}），用于只有检索页、没有稳定栏目的平台。
  const sources = rule.searchTemplate
    ? rule.keywords.map(kw => ({ base: rule.searchTemplate.replace('{kw}', encodeURIComponent(kw)), kw }))
    : [{ base: rule.listingUrl, kw: null }];
  for (const source of sources) {
    for (let page = 1; page <= maxPages; page += 1) {
      const isPostSearch = rule.searchMethod === 'POST' && source.kw != null;
      const url = page === 1
        ? (isPostSearch ? rule.searchTemplate : source.base)
        : String(rule.pageTemplate || source.base).replace('{kw}', encodeURIComponent(source.kw || '')).replace('{n}', String(page));
      let response;
      try {
        const options = {};
        if (rule.headers) options.headers = rule.headers;
        if (isPostSearch) {
          options.method = 'POST';
          options.headers = { 'content-type': 'application/x-www-form-urlencoded', ...(rule.headers || {}) };
          options.body = String(rule.searchBodyTemplate || 'keyword={kw}').replace('{kw}', encodeURIComponent(source.kw));
        }
        response = await fetchText(url, options);
      } catch (error) {
        if (page === 1) throw error;
        result.notes.push(`第${page}页抓取失败：${error.message}`); break;
      }
      if (response.status === 404) { if (page === 1) throw new Error('列表页 404'); break; }
      if (response.status !== 200) { if (page === 1) throw new Error(`列表页 HTTP ${response.status}`); break; }
      result.pagesScanned += 1;
      const items = rule.itemRegex ? extractVendorItems(response.text, url, rule) : extractAnchors(response.text, url);
      for (const anchor of items) {
        if (rule.titleStrip && anchor.title) anchor.title = anchor.title.replace(new RegExp(rule.titleStrip), '').trim();
        if (rule.normalizeHttps && anchor.url && anchor.url.startsWith('http://')) anchor.url = anchor.url.replace('http://', 'https://');
        if (!keyword.test(anchor.title) || seen.has(anchor.url)) continue;
        seen.add(anchor.url);
        result.discovered += 1;
        result.candidates.push(makeCandidate({
          title: anchor.title, url: anchor.url, source: rule.name,
          publishDate: anchor.date || (rule.dateFromUrl ? extractDateFromUrl(anchor.url) : undefined),
          typeText: rule.defaultTypeText || '', region: rule.defaultRegion, sourceAuthority: rule.sourceAuthority || 'official',
        }));
      }
      await sleep(rule.requestDelayMs ?? 800);
    }
  }
  let enriched = 0;
  for (const candidate of result.candidates) {
    if (!candidate.line || !candidate.bidStatus) continue;
    if (candidate.sourceAuthority !== 'official' && candidate.sourceAuthority !== '公开') continue;
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

// —— 适配器：SPA 平台 JSON 检索接口（POST/GET 返回结构化公告；详情走各平台内容接口） ——
function getPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function fillTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

// 无独立详情接口时，用官方接口返回的公告字段合成证据锚（仍来自官方平台，非聚合站）。
function synthesizeEvidence(candidate, rule) {
  const row = candidate.rawRow || {};
  const conf = rule.response || {};
  const parts = [candidate.title];
  const typeText = conf.typeTextField ? row[conf.typeTextField] : '';
  if (typeText) parts.push(String(typeText));
  const extra = [];
  for (const key of (rule.evidenceFields || [])) {
    if (row[key] != null && row[key] !== '') extra.push(`${key}=${String(row[key]).slice(0, 40)}`);
  }
  parts.push(`来源:${candidate.source}`);
  if (candidate.publishDate) parts.push(`发布:${candidate.publishDate}`);
  if (extra.length) parts.push(extra.join('｜'));
  parts.push(`官方接口:${rule.searchEndpoint}`);
  return parts.join('｜');
}

async function enrichJsonApiDetail(candidate, rule) {
  const detail = rule.detail;
  const id = candidate.rawRow?.[(rule.response || {}).idField] ?? '';
  try {
    if (detail && detail.enabled !== false && detail.endpoint) {
      const url = fillTemplate(detail.endpoint, { id, ...(candidate.rawRow || {}) });
      const headers = { 'content-type': 'application/json;charset=UTF-8', ...(rule.headers || {}), ...(detail.headers || {}) };
      const method = (detail.method || 'POST').toUpperCase();
      const body = method === 'POST' ? fillTemplate(detail.bodyTemplate || '{}', { id, ...(candidate.rawRow || {}) }) : undefined;
      const response = await fetchText(url, { method, headers, body });
      if (response.status === 200) {
        let content = '';
        try {
          content = String(getPath(JSON.parse(response.text), detail.contentPath) || '');
        } catch {
          content = response.text;
        }
        if (content && content.length > 30) {
          const text = /<[a-z][\s\S]*>/i.test(content) ? htmlToText(content) : content;
          candidate.evidence = excerptEvidence(text);
          candidate.evidenceCapturedAt = new Date().toISOString();
          const amount = extractAmount(text);
          const budget = extractBudget(text);
          const buyer = extractBuyer(text);
          const procurement = extractProcurement(text);
          if (candidate.bidStatus === '已中标' || candidate.bidStatus === '中标候选人') {
            if (amount) candidate.amount = amount.display;
            else if (budget) candidate.amount = budget.display;
            const winner = extractWinner(text);
            if (winner) candidate.competitor = candidate.bidStatus === '中标候选人' ? `${winner}（第一候选人）` : winner;
          } else if (candidate.bidStatus === '招标公告') {
            if (amount) candidate.amount = amount.display;
            else if (budget) candidate.amount = budget.display;
            candidate.bidOpenDate = extractBidOpenDate(text) || null;
          }
          if (budget) candidate.budget = budget.display;
          if (buyer) candidate.buyer = buyer;
          if (procurement) candidate.procurement = procurement;
          return candidate;
        }
      }
    }
  } catch {
    /* 详情抓取失败：回退到官方字段合成，不阻断 */
  }
  if (!candidate.evidence) candidate.evidence = synthesizeEvidence(candidate, rule);
  candidate.evidenceCapturedAt = candidate.evidenceCapturedAt || new Date().toISOString();
  return candidate;
}

export async function runJsonApiAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 2;
  const maxDetails = limits.maxDetails ?? 20;
  const delay = rule.requestDelayMs ?? 2500;
  const pageSize = rule.pageSize || 20;
  const conf = rule.response || {};
  const baseHeaders = { accept: 'application/json, text/plain, */*', ...(rule.headers || {}) };
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  const categories = rule.categoryValues && rule.categoryValues.length ? rule.categoryValues : [null];
  const pageStart = rule.pageStart ?? 1;

  const blockPatterns = (rule.titleBlocklist || []).map((source) => new RegExp(source));
  const includePattern = rule.titleInclude ? new RegExp(rule.titleInclude, 'i') : null;
  for (const category of categories) {
  for (const keyword of rule.keywords) {
    for (let page = pageStart; page < pageStart + maxPages; page += 1) {
      const rawBody = {
        ...(rule.extraParams || {}),
        [rule.pageParam || 'pageNo']: page,
        [rule.sizeParam || 'pageSize']: pageSize,
        [rule.keywordParam || 'keyword']: keyword,
      };
      if (rule.categoryParam && category) rawBody[rule.categoryParam] = category;
      let body;
      let headers = baseHeaders;
      if (rule.bodyFormat === 'form') {
        body = new URLSearchParams(rawBody).toString();
        headers = { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', ...baseHeaders };
      } else {
        body = JSON.stringify(rawBody);
        headers = { 'content-type': 'application/json;charset=UTF-8', ...baseHeaders };
      }
      let payload;
      try {
        const response = await fetchText(rule.searchEndpoint, {
          method: rule.method || 'POST',
          headers,
          body,
        });
        if (response.status !== 200) {
          if (page === 1) throw new Error(`检索接口 HTTP ${response.status}`);
          result.notes.push(`第${page}页抓取失败：HTTP ${response.status}`);
          break;
        }
        payload = JSON.parse(response.text);
      } catch (error) {
        if (page === 1) throw error;
        result.notes.push(`第${page}页抓取失败：${error.message}`);
        break;
      }
      result.pagesScanned += 1;
      const rows = getPath(payload, conf.rowsPath);
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const row of rows) {
        const title = String(row[conf.titleField] || '').trim();
        if (!title) continue;
        if (blockPatterns.some((re) => re.test(title))) continue;
        // 服务端不支持关键词检索的平台（如淮北矿业），用规则级 titleInclude 在客户端收敛。
        if (includePattern && !includePattern.test(title)) continue;
        const id = row[conf.idField];
        const url = fillTemplate(rule.urlTemplate, { id, ...row });
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const publishDate = normalizeDate(row[conf.dateField]);
        // 服务端排序不可控时，按规则开启时间窗过滤（默认关闭，保持既有规则行为不变）。
        if (rule.filterWindow && publishDate && (publishDate < window.from || publishDate > window.to)) continue;
        result.discovered += 1;
        const candidate = makeCandidate({
          title,
          url,
          source: rule.name,
          publishDate,
          typeText: conf.typeTextField ? String(row[conf.typeTextField] || '') : '',
          region: rule.defaultRegion,
          sourceAuthority: rule.sourceAuthority || 'official',
        });
        candidate.rawRow = row;
        result.candidates.push(candidate);
      }
      if (rows.length < pageSize) break;
      await sleep(delay);
    }
    await sleep(delay);
  }
  }

  let enriched = 0;
  for (const candidate of result.candidates) {
    if (!candidate.line || !candidate.bidStatus) continue;
    if (enriched >= maxDetails) { result.notes.push('已达单次详情抓取上限，剩余候选下次运行继续'); break; }
    await enrichJsonApiDetail(candidate, rule);
    enriched += 1;
    await sleep(delay);
  }
  return result;
}

// —— 竞品官网/官方自媒体：交易信号自宣（置信度中） ——
// 口径：仅收「中标/签约/订单/交付/验收」等交易信号，且标题命中两类设备；
// 荣誉/展会/党建/专利/软文等非交易信号一律不收。金额只取正文披露，否则"未披露"。
export const VENDOR_AUTHORITY = '官方自宣';

// 交易信号词表：仅保留“项目/设备成交、签约、供货、交付、投运”类硬信号。
// 刻意不含裸「运营/安装/调试/到场/下线」——官网产品介绍页常出现“运营维护成本低”等
// 描述词，会把产品页误判成交易新闻（枣庄海纳产品页即踩过此坑）。
const TRADE_SIGNAL = /中标|成交|签约|签订|合同|订单|框架协议|供货|交付|发运|发货|到货|验收|投运|投产|投入运营|正式运营|移交|承租|租赁|BOT|总承包|中标候选人/;

// 订单数量词（“十台套智能干选机”“3套分选系统”）本身即成交/签约信号，单独兜底。
const ORDER_QUANTITY = /[\d一二三四五六七八九十百千万]+\s*台(?:套)?(?!班|风|面|词|阶|湾|账)|[\d一二三四五六七八九十百千万]+\s*套(?:系统|设备|机组|装置)?/;

// 把 classifyLine 的矿石线路名归一到台账既有口径（'矿石XRT光电分选设备'）。
export function canonicalLine(line) {
  if (line === 'XRT矿石分选设备') return '矿石XRT光电分选设备';
  return line;
}

// 官网自宣交易信号 → 台账 bid 阶段（与 group_projects 的 RANK 对齐）。
export function mapVendorSignal(title) {
  if (!title) return null;
  if (/流标|废标|终止|暂停|撤销/.test(title)) return null;
  const hasTrade = TRADE_SIGNAL.test(title);
  const hasOrderQty = ORDER_QUANTITY.test(title);
  if (!hasTrade && !hasOrderQty) return null;
  if (/候选人/.test(title)) return '中标候选人';
  if (/中标|成交/.test(title)) return '已中标';
  if (/签约|签订|合同|订单|框架协议|总承包|供货/.test(title)) return '已签约';
  if (/投运|投产|投入运营|正式运营|移交|承租|租赁|BOT/.test(title)) return '已投运';
  if (/交付|发运|发货|到货|验收/.test(title)) return '已交付';
  if (hasOrderQty) return '已签约';
  return null;
}

// 官网列表页常把“发布日期”“正文摘要”一起塞进 <a> 文本。清掉日期前后缀与分隔符，
// 只留标题主体，避免用摘要文字做线路/信号判定。
export function cleanVendorTitle(raw) {
  if (!raw) return '';
  let t = String(raw).replace(/\s+/g, ' ').trim();
  t = t.replace(/^20\d{2}[\s./-]*\d{1,2}[\s./-]*\d{1,2}\s*/, '');       // 前置日期 2026 08-12
  t = t.replace(/\s*20\d{2}[./-]\d{1,2}([./-]\d{1,2})?\s*$/, '');      // 后置日期 2026-08-17
  t = t.replace(/^[|｜·・\-\s]+/, '').replace(/[|｜\s]+$/, '');
  return t.trim();
}

// 从 URL 反推发布日期（如 /xinwen/20260805.html → 2026-08-05）。
export function extractDateFromUrl(url) {
  if (!url) return null;
  const s = String(url);
  const compact = s.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const dashed = s.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dashed) return `${dashed[1]}-${dashed[2].padStart(2, '0')}-${dashed[3].padStart(2, '0')}`;
  const ymd = s.match(/(20\d{2})\/[a-z]+\/(\d{2})(\d{2})\//);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
}

async function enrichVendorDetail(candidate) {
  try {
    const { status, text } = await fetchText(candidate.url, { timeout: 25000 });
    if (status === 200 && text.length >= 400) {
      const body = htmlToText(text);
      candidate.evidence = excerptEvidence(body);
      candidate.evidenceCapturedAt = new Date().toISOString();
      const amount = extractAmount(body);
      const budget = extractBudget(body);
      const buyer = extractBuyer(body);
      if (amount) candidate.amount = amount.display;
      else if (budget) candidate.budget = budget.display;
      if (buyer) candidate.buyer = buyer;
      // 官网/官方自媒体页含大量导航/版式文字，extractProcurement 易把页面 chrome 当“采购内容”，故不写该字段。
      if (!candidate.amount) candidate.amountNote = '官网/官方自媒体正文未披露金额，按未披露处理';
    }
  } catch {
    /* 详情抓取失败：保留列表页证据，不阻断 */
  }
  if (!candidate.evidence) candidate.evidence = `${candidate.source}：${candidate.title}（官网列表页标题，正文抓取失败，金额未披露）`;
  candidate.evidenceCapturedAt = candidate.evidenceCapturedAt || new Date().toISOString();
  return candidate;
}

// 竞品官网列表解析：
// - 默认走 <a> 锚点（可用 hrefPattern 过滤掉导航/产品页）。
// - 若列表由内嵌 JS 数组或自定义区块渲染（金石 var news=[...]、好朋友 blog-post），
//   用 itemRegex（命名组 url/title/date/file）+ urlBase + dateFromFile 直接解析原始 HTML。
export function extractVendorItems(html, pageUrl, rule) {
  const items = [];
  if (rule.itemRegex) {
    const re = new RegExp(rule.itemRegex, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const g = m.groups || {};
      let url = g.url || '';
      if (url && rule.urlBase) { try { url = new URL(url, rule.urlBase).href; } catch { /* 保留原值 */ } }
      let date = g.date || null;
      if (!date && rule.dateFromFile && g.file) date = `${g.file.slice(0, 4)}-${g.file.slice(4, 6)}-${g.file.slice(6, 8)}`;
      const title = (g.title || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (url && title) items.push({ url, title, date });
      if (items.length >= 800) break;
    }
    return items;
  }
  const hrefRe = rule.hrefPattern ? new RegExp(rule.hrefPattern, 'i') : null;
  for (const anchor of extractAnchors(html, pageUrl)) {
    if (hrefRe && !hrefRe.test(anchor.url)) continue;
    items.push({ url: anchor.url, title: anchor.title, date: anchor.date });
  }
  return items;
}

export async function runVendorNewsAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 2;
  const maxDetails = limits.maxDetails ?? 15;
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const url = page === 1 ? rule.listingUrl : (rule.pageTemplate ? rule.pageTemplate.replace('{n}', String(page)) : null);
    if (!url) break;
    let response;
    try {
      response = await fetchText(url, { timeout: 25000 });
    } catch (error) {
      if (page === 1) throw error;
      result.notes.push(`第${page}页抓取失败：${error.message}`);
      break;
    }
    if (response.status !== 200) {
      if (page === 1) throw new Error(`列表页 HTTP ${response.status}`);
      result.notes.push(`第${page}页 HTTP ${response.status}`);
      break;
    }
    result.pagesScanned += 1;
    for (const item of extractVendorItems(response.text, url, rule)) {
      if (seen.has(item.url)) continue;
      const title = cleanVendorTitle(item.title);
      if (!title || title.length < 8) continue;
      const line = canonicalLine(classifyLine(title));
      if (!line) continue;
      const signal = mapVendorSignal(title);
      if (!signal) continue;
      seen.add(item.url);
      result.discovered += 1;
      result.candidates.push({
        title,
        url: item.url,
        source: rule.name,
        publishDate: item.date || extractDateFromUrl(item.url),
        line,
        bidStatus: signal,
        bid: signal,
        region: rule.defaultRegion || '未披露',
        mineral: rule.defaultMineral || '未披露',
        competitor: rule.vendorName || '未披露',
        sourceAuthority: VENDOR_AUTHORITY,
      });
    }
    await sleep(800);
  }
  // 新→旧排序：周更场景先保证最近的交易新闻拿到详情；回填时再逐次补齐更早年份。
  result.candidates.sort((a, b) => String(b.publishDate || '').localeCompare(String(a.publishDate || '')));
  let enriched = 0;
  for (const candidate of result.candidates) {
    if (enriched >= maxDetails) { result.notes.push('已达单次详情抓取上限，剩余候选下次运行继续'); break; }
    await enrichVendorDetail(candidate);
    enriched += 1;
    await sleep(600);
  }
  return result;
}

// —— 公众号低置信线索（第三方数据源：搜狗微信收录 + 公众号直搜） ——
// 口径：只取「标题 + 摘要 + 日期 + 公众号名 + 链接」；搜狗不提供正文，须点击链接人工查看。
// 这批线索置信度固定为「低」（前端单独分区，易与高/中置信台账区分），仅作线索雷达，不替代官方公告。
export const WECHAT_AUTHORITY = '公众号线索';

export async function runSogouWechatAdapter(rule, window, limits = {}) {
  const { searchWechatByKeyword } = await import('./wechat-sogou.mjs');
  const num = limits.maxResults ?? rule.maxResults ?? 10;
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  // 公众号雷达用滚动回看窗口（默认 120 天）：搜狗收录滞后约一周、行业低频，14 天窗会全落空；
  // 已入池线索按标题去重，故加宽窗口不会重复入库。
  const lookback = rule.lookbackDays ?? 120;
  const cutoff = new Date(`${window.to}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - lookback);
  let from = cutoff.toISOString().slice(0, 10);
  if (from < MINIMUM_PUBLISH_DATE) from = MINIMUM_PUBLISH_DATE;
  result.notes.push(`回看窗口：${from} ~ ${window.to}`);
  // 两路检索：① 竞品短名（公众号直搜）② 设备词（搜狗第三方收录）；两路结果合并去重。
  const groups = [
    { list: rule.vendorKeywords || [], via: '公众号直搜' },
    { list: rule.deviceKeywords || [], via: '搜狗收录' },
  ];
  for (const group of groups) {
    for (const keyword of group.list) {
      let articles = [];
      try {
        articles = await searchWechatByKeyword(keyword, { num, pages: 1 });
      } catch (error) {
        result.notes.push(`「${keyword}」检索失败：${error.message}`);
        continue;
      }
      result.pagesScanned += 1;
      for (const article of articles) {
        const key = String(article.title || '').replace(/\s+/g, '');
        if (!key || seen.has(key)) continue;
        const line = classifyLine(`${article.title} ${article.summary || ''}`);
        if (!line) continue;
        // 相关即收（2026-09-22 口径）：命中范围即收录；有交易信号标信号，否则记「非交易动态」。
        const signal = mapVendorSignal(article.title) || mapVendorSignal(article.summary || '');
        // 无日期的结果无法核验时效，不计入（搜狗收录通常带时间戳）。
        if (!article.publishDate || article.publishDate < from) continue;
        seen.add(key);
        result.discovered += 1;
        result.candidates.push({
          title: article.title,
          url: article.sogouUrl || article.url,
          account: article.account || '',
          source: article.account ? `微信公众号·${article.account}` : '微信公众号',
          summary: article.summary || '',
          publishDate: article.publishDate,
          line: canonicalLine(line),
          bidStatus: signal || '非交易动态',
          via: group.via,
          query: keyword,
          sourceAuthority: WECHAT_AUTHORITY,
        });
      }
      await sleep(1200);
    }
  }
  return result;
}

// —— 适配器：国泰新点 CMS 检索接口（/cms/api/dynamicData/queryContentPage）——
// 适用：秦源招标（陕煤）、同模板的 Epoint 系平台。返回标题+正文 HTML，无需二次抓详情。
export async function runCmsQueryAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 1;
  const maxDetails = limits.maxDetails ?? 30;
  const pageSize = rule.pageSize || 20;
  const keyword = new RegExp(rule.keywords.join('|'), 'i');
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  let enriched = 0;
  for (const category of rule.categories || []) {
    for (let page = 1; page <= maxPages; page += 1) {
      const body = JSON.stringify({ pageNo: page, pageSize, dto: { siteId: rule.siteId, categoryId: category.categoryId } });
      let payload;
      try {
        const { status, text } = await fetchText(rule.searchEndpoint, {
          method: rule.method || 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8', 'x-requested-with': 'XMLHttpRequest', ...(rule.headers || {}) },
          body,
        });
        if (status !== 200) { if (page === 1) throw new Error(`检索接口 HTTP ${status}`); break; }
        payload = JSON.parse(text);
      } catch (error) {
        if (page === 1) { result.notes.push(`「${category.name}」检索失败：${error.message}`); }
        break;
      }
      const rows = payload?.res?.rows || [];
      result.pagesScanned += 1;
      if (!rows.length) break;
      let oldest = null;
      for (const row of rows) {
        const title = String(row.title || '').trim();
        if (!title) continue;
        const date = extractDateFromUrl(row.url) || normalizeDate(row.publishTime || '');
        if (date && (!oldest || date < oldest)) oldest = date;
        if (!keyword.test(title)) continue;
        if (date && date < window.from) continue;
        // row.url 常为站点根绝对路径（如 /zbgg/20260911/xxx.html），直接拼 urlBase 前缀更可靠。
        const rawUrl = String(row.url || '');
        let url = null;
        try {
          url = rawUrl.startsWith('/') ? String(rule.urlBase || '').replace(/\/+$/, '') + rawUrl : new URL(rawUrl, rule.urlBase).href;
        } catch { continue; }
        if (!url || seen.has(url)) continue;
        seen.add(url);
        result.discovered += 1;
        const candidate = makeCandidate({
          title, url, source: `${rule.name}· ${category.name}`, publishDate: date,
          typeText: category.name, region: rule.defaultRegion, sourceAuthority: 'official',
        });
        candidate.rawRow = row;
        result.candidates.push(candidate);
      }
      // 列表按发布时间倒序：整页都早于窗口下限时停止翻页。
      if (oldest && oldest < window.from) break;
      await sleep(rule.requestDelayMs ?? 800);
    }
  }
  // 该接口的正文 HTML 已在列表响应里（row.text），直接就地抽取，无需再抓详情页。
  for (const candidate of result.candidates) {
    if (enriched >= maxDetails) { result.notes.push('已达单次抽取上限，剩余候选下次运行继续'); break; }
    const body = htmlToText(candidate.rawRow?.text || '');
    if (body.length > 30) {
      candidate.evidence = excerptEvidence(body);
      candidate.evidenceCapturedAt = new Date().toISOString();
      const amount = extractAmount(body); const budget = extractBudget(body);
      const buyer = extractBuyer(body); const procurement = extractProcurement(body);
      if (candidate.bidStatus === '已中标' || candidate.bidStatus === '中标候选人') {
        if (amount) candidate.amount = amount.display; else if (budget) candidate.amount = budget.display;
        const winner = extractWinner(body);
        if (winner) candidate.competitor = candidate.bidStatus === '中标候选人' ? `${winner}（第一候选人）` : winner;
      } else if (candidate.bidStatus === '招标公告') {
        if (amount) candidate.amount = amount.display; else if (budget) candidate.amount = budget.display;
        candidate.bidOpenDate = extractBidOpenDate(body) || null;
      }
      if (budget) candidate.budget = budget.display;
      if (buyer) candidate.buyer = buyer;
      if (procurement) candidate.procurement = procurement;
      enriched += 1;
    }
    delete candidate.rawRow;
  }
  return result;
}

// —— 适配器：AjaxPro 列表接口（ASP.NET AjaxPro，中国能建 ceec 等）——
// 约定：POST {endpoint}，头 X-AjaxPro-Method={method}，body 为参数 JSON；
// 响应是被引号包裹的 JSON 串（尾部带 ;/*），需剥离后再解析。
function parseAjaxProPayload(text) {
  let raw = String(text || '').trim();
  raw = raw.replace(/^"|";\/\*[\s\S]*$|\/\*[\s\S]*$|\/\*$/g, '');
  try { return JSON.parse(raw); } catch { /* 尝试反转义后再解析 */ }
  try { return JSON.parse(raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')); } catch { return null; }
}

export async function runAjaxProAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 1;
  const maxDetails = limits.maxDetails ?? 20;
  const pageSize = rule.pageSize || 20;
  const keyword = new RegExp(rule.keywords.join('|'), 'i');
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  const b64u16 = s => Buffer.from(String(s), 'utf16le').toString('base64');
  for (const category of rule.categories || []) {
    for (let page = 1; page <= maxPages; page += 1) {
      const body = JSON.stringify({
        ...(rule.extraParams || {}),
        [rule.codeParam || '_bigtype_base64']: b64u16(category.code),
        [rule.smallParam || '_smalltype_base64']: '',
        [rule.pageParam || '_pageIndex']: page,
        [rule.sizeParam || '_pageSize']: pageSize,
      });
      let payload;
      try {
        const { status, text } = await fetchText(rule.searchEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'text/plain; charset=UTF-8', 'x-ajaxpro-method': rule.ajaxMethod || 'getdata', referer: rule.referer || rule.entryUrl, ...(rule.headers || {}) },
          body,
        });
        if (status !== 200) { if (page === 1) throw new Error(`检索接口 HTTP ${status}`); break; }
        payload = parseAjaxProPayload(text);
      } catch (error) {
        if (page === 1) result.notes.push(`「${category.name}」检索失败：${error.message}`);
        break;
      }
      const rows = payload?.maindata?.[0] || [];
      result.pagesScanned += 1;
      if (!rows.length) break;
      let oldest = null;
      for (const row of rows) {
        const title = String(row.GongGaoBT || row.ZhaoBiaoXMMC || row.zbxmmc || row.ZhuanTiMC || '').trim();
        if (!title) continue;
        const date = normalizeDate(row.GongGaoFBSJ || row.fbsj || row.ShangBaoSJ || row.YuGaoFBSJ || '');
        if (date && (!oldest || date < oldest)) oldest = date;
        if (!keyword.test(title)) continue;
        if (date && date < window.from) continue;
        const id = row.sys_epsid || row.sys_id || row.zbxmbh || row.ZhaoBiaoXMBH || '';
        const url = rule.urlTemplate
          ? rule.urlTemplate.replace('{id}', encodeURIComponent(id)).replace('{code}', b64u16(category.code))
          : null;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        result.discovered += 1;
        result.candidates.push(makeCandidate({
          title, url, source: `${rule.name}· ${category.name}`, publishDate: date,
          typeText: category.name, region: rule.defaultRegion, sourceAuthority: 'official',
        }));
      }
      if (oldest && oldest < window.from) break;
      await sleep(rule.requestDelayMs ?? 900);
    }
  }
  let enriched = 0;
  for (const candidate of result.candidates) {
    if (enriched >= maxDetails) { result.notes.push('已达单次详情抓取上限，剩余候选下次运行继续'); break; }
    await enrichFromOfficialDetail(candidate, candidate.url);
    enriched += 1;
    await sleep(700);
  }
  return result;
}

// —— 适配器：巨潮资讯网上市公司公告（美腾/泰禾等，日常经营合同/中标/签约） ——
// 公开 JSON 检索接口；公告原文为 PDF，用 pdf-parse 提取正文后再判定设备线与金额，
// 解析失败或不命中设备线的一律不入账（避免凭标题误收）。
const CNINFO_INCLUDE = /合同|订单|中标|签约|销售|供货|采购|交付|验收|投产|投运/;
const CNINFO_EXCLUDE = /激励|董事|监事|股东|回购|质押|问询|投资者|业绩|年度报告|半年度报告|季度报告|审计|章程|议事规则|选举|辞职|减持|增持|募集|独立董事|保荐|限售|诉讼|处罚|担保|现金管理|闲置|会计政策|风险提示|更正|补充公告|说明会|接待|调研|高级管理人员/;
export async function runCninfoAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 3;
  const pageSize = rule.pageSize || 30;
  const maxPdf = limits.maxDetails ?? rule.maxPdf ?? 12;
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const seen = new Set();
  let parsePdf = null;
  try { parsePdf = (await import('pdf-parse/lib/pdf-parse.js')).default; } catch (error) { result.notes.push(`未安装 pdf-parse，公告 PDF 正文无法解析，本轮跳过全部候选（${error.message}）`); }
  let parsed = 0;
  for (const stock of rule.stocks || []) {
    for (let page = 1; page <= maxPages; page += 1) {
      const body = new URLSearchParams({
        pageNum: String(page), pageSize: String(pageSize), column: rule.column || 'szse',
        tabName: 'fulltext', plate: '', stock: `${stock.code},${stock.orgId}`,
        searchkey: '', secid: '', category: '', trade: '',
        seDate: `${window.from}~${window.to}`, sortName: '', sortType: '', isHLtitle: 'true',
      });
      let payload;
      try {
        const response = await fetchText(rule.searchEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', referer: 'http://www.cninfo.com.cn/new/commonUrl?url=disclosure/list/notice' },
          body: body.toString(),
        });
        if (response.status !== 200) { if (page === 1) throw new Error(`检索接口 HTTP ${response.status}`); break; }
        payload = JSON.parse(response.text);
      } catch (error) {
        if (page === 1) throw error;
        result.notes.push(`第${page}页抓取失败：${error.message}`);
        break;
      }
      result.pagesScanned += 1;
      const rows = payload.announcements || [];
      if (!rows.length) break;
      for (const row of rows) {
        const title = String(row.announcementTitle || '').replace(/<[^>]+>/g, '').trim();
        if (!title || !CNINFO_INCLUDE.test(title) || CNINFO_EXCLUDE.test(title)) continue;
        const path = String(row.adjunctUrl || '');
        if (!path) continue;
        const url = /^https?:/.test(path) ? path.replace(/^http:/, 'https:') : `https://static.cninfo.com.cn/${path}`;
        if (seen.has(url)) continue;
        seen.add(url);
        const publishDate = new Date(Number(row.announcementTime)).toISOString().slice(0, 10);
        if (publishDate < window.from) continue;
        result.discovered += 1;
        if (!parsePdf || parsed >= maxPdf) continue;
        parsed += 1;
        let bodyText = '';
        try {
          const resp = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
          if (resp.ok) bodyText = String((await parsePdf(Buffer.from(await resp.arrayBuffer()))).text || '');
        } catch (error) { result.notes.push(`PDF 解析失败《${title.slice(0, 24)}》：${error.message}`); }
        await sleep(500);
        if (bodyText.length < 60) continue;
        const line = canonicalLine(classifyLine(`${title} ${bodyText.slice(0, 4000)}`));
        if (!line) continue;
        const signal = mapVendorSignal(title) || (/中标/.test(title) ? '已中标' : /交付|验收|发运/.test(title) ? '已交付' : /投运|投产/.test(title) ? '已投运' : '已签约');
        const candidate = makeCandidate({
          title, url, source: `${rule.name}（${stock.name}）`, publishDate,
          typeText: '', region: rule.defaultRegion, sourceAuthority: VENDOR_AUTHORITY,
        });
        candidate.line = line;
        candidate.bidStatus = signal;
        candidate.bid = signal;
        candidate.competitor = stock.vendorName || '未披露';
        candidate.evidence = excerptEvidence(bodyText.replace(/\s+/g, ' '));
        candidate.evidenceCapturedAt = new Date().toISOString();
        const amount = extractAmount(bodyText);
        candidate.amount = amount ? amount.display : '未披露';
        if (!amount) candidate.amountNote = '上市公司公告 PDF 原文未载明成交金额或未自动识别，详见公告原文';
        result.candidates.push(candidate);
        await sleep(rule.requestDelayMs ?? 1200);
      }
      if (rows.length < pageSize) break;
      await sleep(rule.requestDelayMs ?? 1200);
    }
  }
  return result;
}

// —— 适配器：Scrapling 隐身浏览器桥（WAF/指纹反爬平台的公开检索页与详情页） ——
// 依赖本地 .venv 内的 Scrapling（scripts/scrapling_fetch.py 为桥）；CI 无环境时跳过并记备注。
const SCRAPLING_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 定位 Scrapling 运行环境：规则 pythonPath > 环境变量 > 项目根目录旁的 .venv（Windows/Unix）。
export function resolveScraplingPython(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.SCRAPLING_PYTHON,
    path.join(SCRAPLING_ROOT, '..', '.venv', 'Scripts', 'python.exe'),
    path.join(SCRAPLING_ROOT, '..', '.venv', 'bin', 'python'),
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate)) || null;
}

function runScraplingBridge(python, spec) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'scrapling-bridge-'));
  const specFile = path.join(dir, 'spec.json');
  writeFileSync(specFile, JSON.stringify(spec), 'utf8');
  try {
    const bridge = path.join(SCRAPLING_ROOT, 'scripts', 'scrapling_fetch.py');
    const result = spawnSync(python, ['-X', 'utf8', bridge, specFile], {
      encoding: 'utf8',
      timeout: (spec.timeout || 90000) + 30000,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`桥接退出码 ${result.status}：${String(result.stderr || '').trim().slice(0, 200)}`);
    const start = String(result.stdout).indexOf('{');
    if (start < 0) throw new Error('桥接未返回 JSON');
    const payload = JSON.parse(String(result.stdout).slice(start));
    if (!payload.ok) throw new Error(payload.error || '桥接返回失败');
    return payload;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* 临时目录清理失败可忽略 */ }
  }
}

// 从桥接捕获的 XHR JSON 中解析公告行（纯函数，便于离线测试）。
export function parseScraplingJsonRows(payload, rule) {
  const rows = [];
  for (const xhr of payload.xhr || []) {
    let data;
    try { data = JSON.parse(xhr.body); } catch { continue; }
    const list = getPath(data, rule.jsonListPath || '');
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const title = String(item[rule.titleField] ?? '').replace(/\s+/g, ' ').trim();
      if (!title) continue;
      const rawDate = item[rule.dateField];
      let publishDate = null;
      if (rule.epochMs && rawDate !== null && rawDate !== undefined && rawDate !== '') {
        // 平台时间戳为 UTC 毫秒，按规则声明的时区偏移（小时）换算成当地发布日期。
        const date = new Date(Number(rawDate) + (rule.timezoneOffset || 0) * 3600 * 1000);
        if (!Number.isNaN(date.getTime())) publishDate = date.toISOString().slice(0, 10);
      } else {
        publishDate = normalizeDate(rawDate);
      }
      const id = rule.idField ? item[rule.idField] : null;
      if (!publishDate || id === null || id === undefined) continue;
      rows.push({
        title,
        publishDate,
        url: fillTemplate(rule.urlTemplate || '{id}', { id: String(id) }),
        typeText: (rule.typeMap && rule.typeMap[String(item[rule.typeField])]) || '',
      });
    }
  }
  return rows;
}

// 渲染后 HTML 解析：SPA 列表页由隐身浏览器渲染出真实 DOM 后，按 itemRegex/锚点提取（纯函数，便于离线测试）。
export function parseScraplingRenderedItems(html, pageUrl, rule) {
  return extractVendorItems(html || '', pageUrl, rule).map(item => ({
    title: (item.title || '').trim(),
    url: rule.normalizeHttps && item.url && item.url.startsWith('http://') ? item.url.replace('http://', 'https://') : item.url,
    publishDate: item.date ? normalizeDate(item.date) : null,
    typeText: rule.defaultTypeText || '',
  }));
}

export async function runScraplingAdapter(rule, window, limits = {}) {
  // 浏览器详情抓取耗时高：以规则自身 maxDetails 为硬上限，避免 backfill 大限额拖垮整轮。
  const detailCap = rule.maxDetails ?? 8;
  const maxDetails = Math.min(limits.maxDetails ?? detailCap, detailCap);
  const result = { pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  const python = resolveScraplingPython(rule.pythonPath);
  if (!python) {
    result.notes.push('未找到 Scrapling 运行环境（本地 .venv），本规则跳过（CI 环境预期）');
    return result;
  }
  const include = rule.includeRegex ? new RegExp(rule.includeRegex, 'i') : null;
  const exclude = rule.excludeRegex ? new RegExp(rule.excludeRegex, 'i') : null;
  const seen = new Set();
  const sources = rule.searchTemplate
    ? (rule.keywords || []).map(keyword => ({ url: rule.searchTemplate.replace('{kw}', encodeURIComponent(keyword)), keyword }))
    : [{ url: rule.listingUrl, keyword: null }];
  for (const source of sources) {
    let payload;
    try {
      payload = runScraplingBridge(python, {
        url: source.url,
        capture: rule.captureXhr,
        timeout: rule.timeoutMs || 90000,
        actions: rule.actions,
      });
    } catch (error) {
      result.notes.push(`「${source.keyword || source.url}」抓取失败：${error.message}`);
      continue;
    }
    result.pagesScanned += 1;
    const rows = rule.jsonListPath
      ? parseScraplingJsonRows(payload, rule)
      : (rule.parseRendered ? parseScraplingRenderedItems(payload.html || '', payload.url || source.url, rule) : []);
    const keywordPattern = rule.keywords && rule.keywords.length ? new RegExp(rule.keywords.join('|'), 'i') : null;
    for (const row of rows) {
      if (!row.publishDate) continue;
      if (row.publishDate < window.from || row.publishDate > window.to) continue;
      if (keywordPattern && !keywordPattern.test(row.title)) continue;
      if (include && !include.test(row.title)) continue;
      if (exclude && exclude.test(row.title)) continue;
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      result.discovered += 1;
      result.candidates.push(makeCandidate({
        title: row.title, url: row.url, source: rule.name, publishDate: row.publishDate,
        typeText: row.typeText, region: rule.defaultRegion, sourceAuthority: rule.sourceAuthority || 'official',
      }));
    }
    await sleep(rule.requestDelayMs ?? 1500);
  }
  let enriched = 0;
  for (const candidate of result.candidates) {
    if (!candidate.line || !candidate.bidStatus) continue;
    if (enriched >= maxDetails) { result.notes.push('已达单次详情抓取上限，剩余候选下次运行继续'); break; }
    if (rule.detail) {
      try {
        const payload = runScraplingBridge(python, {
          url: candidate.url, capture: rule.detail.captureXhr, timeout: rule.timeoutMs || 90000,
        });
        const data = payload.xhr?.length ? JSON.parse(payload.xhr[0].body) : null;
        let html = data ? getPath(data, rule.detail.htmlPath || '') : null;
        if (!html && rule.detail.rendered && payload.html) html = payload.html;
        if (html) applyDetailBody(candidate, htmlToText(String(html)));
        else result.notes.push(`详情正文未捕获《${candidate.title.slice(0, 24)}》`);
      } catch (error) {
        result.notes.push(`详情抓取失败《${candidate.title.slice(0, 24)}》：${error.message}`);
      }
    } else {
      await enrichFromOfficialDetail(candidate, candidate.url);
    }
    enriched += 1;
    await sleep(rule.detailDelayMs ?? 1200);
  }
  return result;
}

export const ADAPTERS = {
  'ggzy-api': runGgzyApiAdapter,
  'html-list': runHtmlListAdapter,
  'home-scan': runHomeScanAdapter,
  'json-api': runJsonApiAdapter,
  'vendor-news': runVendorNewsAdapter,
  'sogou-wechat': runSogouWechatAdapter,
  'cms-query': runCmsQueryAdapter,
  'ajaxpro-list': runAjaxProAdapter,
  cninfo: runCninfoAdapter,
  probe: runProbeAdapter,
  scrapling: runScraplingAdapter,
};
