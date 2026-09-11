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
const COAL_PATTERN = /干选|干法选煤|干法分选|干法提质|复合干选/;
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

export async function enrichFromOfficialDetail(candidate, detailUrl) {
  try {
    const { status, text } = await fetchText(detailUrl, { timeout: 25000 });
    if (status !== 200 || text.length < 500) return candidate;
    const body = htmlToText(text);
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

  for (const keyword of rule.keywords) {
    for (let page = 1; page <= maxPages; page += 1) {
      const body = {
        ...(rule.extraParams || {}),
        [rule.pageParam || 'pageNo']: page,
        [rule.sizeParam || 'pageSize']: pageSize,
        [rule.keywordParam || 'keyword']: keyword,
      };
      let payload;
      try {
        const response = await fetchText(rule.searchEndpoint, {
          method: rule.method || 'POST',
          headers: baseHeaders,
          body: JSON.stringify(body),
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
        const id = row[conf.idField];
        const url = fillTemplate(rule.urlTemplate, { id, ...row });
        if (!url || seen.has(url)) continue;
        seen.add(url);
        result.discovered += 1;
        const candidate = makeCandidate({
          title,
          url,
          source: rule.name,
          publishDate: normalizeDate(row[conf.dateField]),
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
  const m = String(url).match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
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

export async function runVendorNewsAdapter(rule, window, limits = {}) {
  const maxPages = limits.maxPages ?? rule.maxPages ?? 2;
  const maxDetails = limits.maxDetails ?? 15;
  // 只认真正的新闻详情链接，滤掉导航/产品页/侧栏（如海纳的 /artzngxj.html 产品页）。
  const hrefRe = rule.hrefPattern ? new RegExp(rule.hrefPattern, 'i') : null;
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
    for (const anchor of extractAnchors(response.text, url)) {
      if (seen.has(anchor.url)) continue;
      if (hrefRe && !hrefRe.test(anchor.url)) continue;
      const title = cleanVendorTitle(anchor.title);
      if (!title || title.length < 8) continue;
      const line = canonicalLine(classifyLine(title));
      if (!line) continue;
      const signal = mapVendorSignal(title);
      if (!signal) continue;
      seen.add(anchor.url);
      result.discovered += 1;
      result.candidates.push({
        title,
        url: anchor.url,
        source: rule.name,
        publishDate: anchor.date || extractDateFromUrl(anchor.url),
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

export const ADAPTERS = {
  'ggzy-api': runGgzyApiAdapter,
  'html-list': runHtmlListAdapter,
  'home-scan': runHomeScanAdapter,
  'json-api': runJsonApiAdapter,
  'vendor-news': runVendorNewsAdapter,
  probe: runProbeAdapter,
};
