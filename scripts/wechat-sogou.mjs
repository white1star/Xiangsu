// 第三方数据源：搜狗微信搜索（weixin.sogou.com）——公众号文章收录雷达。
// 口径：只取「标题 + 摘要 + 日期 + 公众号名 + 链接」，正文需人工点开（搜狗不提供全文）。
// 不绕过验证码；遇 /antispider/ 跳转即如实返回空并记录，交由下次重试。
// 自包含实现（无 cheerio 依赖，CI 可直接跑）。

export const SOGOU_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const SOGOU_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  referer: 'https://weixin.sogou.com/',
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function cleanText(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// 公众号文章时间为「秒级时间戳」写在 document.write(timeConvert('1726...')) 里。
function dateFromTimestamp(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n < 1_400_000_000) return null;
  const d = new Date((n + 8 * 3600) * 1000); // 转 UTC+8
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 解析搜狗微信搜索结果页 <ul class="news-list"> 的 <li> 列表。
export function parseSogouNewsList(html) {
  const items = [];
  if (!html || !/<ul[^>]*class=["'][^"']*news-list/i.test(html)) return items;
  const ulStart = html.search(/<ul[^>]*class=["'][^"']*news-list/i);
  const body = html.slice(ulStart);
  const chunks = body.split(/<li\b/i).slice(1);
  for (const chunk of chunks) {
    const h3 = chunk.match(/<h3[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!h3) continue;
    let url = decodeEntities(h3[1]);
    if (url.startsWith('/')) url = `https://weixin.sogou.com${url}`;
    const title = cleanText(h3[2]);
    if (!title) continue;
    const summary = cleanText(chunk.match(/<p[^>]*class=["'][^"']*txt-info[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    const account = cleanText(
      chunk.match(/<a[^>]*class=["'][^"']*account[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]
      || chunk.match(/class=["'][^"']*all-time-y2[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
      || '',
    );
    const ts = chunk.match(/timeConvert\(\s*['"]?(\d{10})['"]?\s*\)/)?.[1] || chunk.match(/\b(1[5-9]\d{8})\b/)?.[1];
    const publishDate = dateFromTimestamp(ts);
    items.push({ title, url, summary, account, publishDate, sogouUrl: url });
  }
  return items;
}

async function fetchSogouPage(url, cookie = '', timeout = 20000) {
  const headers = { ...SOGOU_HEADERS, 'user-agent': SOGOU_UA, host: 'weixin.sogou.com' };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  const text = await response.text();
  const blocked = /antispider|请输入验证码|访问过于频繁|unusual traffic/i.test(text) || /antispider/i.test(response.url);
  return { status: response.status, text, finalUrl: response.url, blocked };
}

async function getSogouCookie() {
  try {
    const response = await fetch('https://v.sogou.com/v?ie=utf8&query=&p=40030600', {
      headers: { ...SOGOU_HEADERS, 'user-agent': SOGOU_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    const setCookie = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    return setCookie.map(c => c.split(';')[0]).join('; ');
  } catch {
    return '';
  }
}

// 把搜狗中间跳转链接还原为 mp.weixin.qq.com 真实链接（常被反爬拦，失败则返回原链接）。
async function resolveRealUrl(sogouUrl, cookie = '') {
  if (!/weixin\.sogou\.com\/link\?/i.test(sogouUrl)) return null;
  try {
    const headers = { ...SOGOU_HEADERS, 'user-agent': SOGOU_UA, referer: 'https://weixin.sogou.com/' };
    if (cookie) headers.cookie = cookie;
    const response = await fetch(sogouUrl, { headers, redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const loc = response.headers.get('location') || '';
    if (/mp\.weixin\.qq\.com/i.test(loc)) return loc;
    if (response.status === 200) {
      const text = await response.text();
      const parts = [...text.matchAll(/url\s*\+=\s*['"]([^'"]*)['"]/g)].map(m => m[1]).join('');
      if (parts.includes('mp.weixin.qq.com')) return parts;
      const js = text.match(/location(?:\.href|\.replace\()\s*=?\s*["']([^"']*mp\.weixin\.qq\.com[^"']*)["']/i);
      if (js) return js[1];
    }
  } catch {
    /* 解析失败：保留搜狗链接（仍可点击跳转） */
  }
  return null;
}

// 搜索公众号文章。type=2 为「文章」搜索（type=1 公众号搜索已被验证码墙封死，勿用）。
export async function searchWechatByKeyword(query, { num = 10, pages = 1, resolveUrls = false, delayMs = 1500 } = {}) {
  const out = [];
  const maxResults = Math.min(Math.max(num, 1), 50);
  const cookie = await getSogouCookie();
  for (let page = 1; page <= pages && out.length < maxResults; page += 1) {
    const url = `https://weixin.sogou.com/weixin?query=${encodeURIComponent(query)}&s_from=input&_sug_=n&type=2&page=${page}&ie=utf8`;
    let parsed = [];
    const attempts = ['', cookie, '', cookie];
    for (let i = 0; i < attempts.length; i += 1) {
      let res;
      try {
        res = await fetchSogouPage(url, attempts[i]);
      } catch {
        res = null;
      }
      if (res && !res.blocked) {
        parsed = parseSogouNewsList(res.text);
        if (parsed.length) break;
      }
      if (i < attempts.length - 1) await sleep(1200 + Math.random() * 1500);
    }
    if (!parsed.length) break;
    for (const item of parsed) {
      if (out.length >= maxResults) break;
      if (!out.some(existing => existing.title === item.title)) out.push({ ...item, query });
    }
    if (page < pages) await sleep(delayMs);
  }
  if (resolveUrls && out.length) {
    for (const item of out) {
      const real = await resolveRealUrl(item.sogouUrl, cookie);
      if (real) { item.url = real; item.resolved = true; }
      await sleep(600 + Math.random() * 600);
    }
  }
  return out.slice(0, maxResults);
}

// CLI：node scripts/wechat-sogou.mjs "美腾" -n 10 -o out.json
async function main() {
  const args = process.argv.slice(2);
  const query = args.find(a => !a.startsWith('-'));
  const numIdx = args.findIndex(a => a === '-n' || a === '--num');
  const num = numIdx >= 0 ? Number(args[numIdx + 1]) || 10 : 10;
  const outIdx = args.findIndex(a => a === '-o' || a === '--output');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : '';
  if (!query) { console.error('用法：node scripts/wechat-sogou.mjs "<关键词>" [-n 数量] [-o 输出.json]'); process.exit(1); }
  const articles = await searchWechatByKeyword(query, { num, resolveUrls: args.includes('-r') });
  const payload = JSON.stringify({ query, total: articles.length, articles }, null, 2);
  if (outFile) { const { writeFileSync } = await import('node:fs'); writeFileSync(outFile, payload, 'utf8'); }
  console.log(payload);
}

if (process.argv[1] && process.argv[1].endsWith('wechat-sogou.mjs')) main();
