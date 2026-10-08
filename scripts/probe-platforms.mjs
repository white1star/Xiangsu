// 平台探测器 v2：多候选域名 + 失败重试 3 次（区分"平台不行"与"网络抖动"）
// 只读体检，不改任何现有代码/配置。输出 reports/platform-probe-report.json
import { writeFileSync, mkdirSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const OUT = 'reports/platform-probe-report.json';
const TIMEOUT = 20000;
const RETRIES = 3;

// 每个平台给多个候选域名（历史证明手写 URL 大概率是错的）
const CANDIDATES = [
  // ===== 主力煤企 =====
  { name: '国家能源·国能e招', kind: 'coal', hosts: ['https://www.chnenergybidding.com.cn'], paths: ['/bidweb/001/001002/moreinfo.html', '/bidweb/001/001005/moreinfo.html'] },
  { name: '中煤集团·中煤招标网', kind: 'coal', hosts: ['https://www.zmzb.com'], paths: ['/cms/channel/ywgg1hw/index.htm', '/cms/channel/ywgg2hw/index.htm'] },
  { name: '中国煤科电子采购', kind: 'coal', hosts: ['https://cg.ccteg.cn'], paths: ['/cms/channel/ywgg4hw/index.htm', '/cms/channel/ywgg4fw/index.htm', '/cms/channel/ywgg1hw/index.htm'] },
  { name: '山东能源·询比价', kind: 'coal', hosts: ['https://www.sdny.com.cn', 'https://www.sdnycg.com', 'https://sdnyzb.com.cn'], paths: ['/xunjia/', '/'] },
  { name: '淮北矿业电子采购', kind: 'coal', hosts: ['https://zbcg.hbcoal.com', 'https://www.hbcoal.com'], paths: ['/', '/zbgg/'] },
  { name: '冀中能源电子招标', kind: 'coal', hosts: ['https://www.jzbidding.com', 'http://www.jzbidding.com'], paths: ['/'] },
  { name: '晋能控股招标采购', kind: 'coal', hosts: ['https://www.jnkgjt.com', 'http://www.jnkgjt.com'], paths: ['/'] },
  { name: '甘肃煤炭交易中心', kind: 'coal', hosts: ['https://www.gsnhcg.com', 'http://www.gsnhcg.com'], paths: ['/'] },
  { name: '甘肃经济信息网', kind: 'coal', hosts: ['https://www.gsei.com.cn'], paths: ['/html/1337/index.html'] },
  { name: '山西公共资源·工程', kind: 'coal', hosts: ['https://prec.sxzwfw.gov.cn', 'https://jyzx.sxzwfw.gov.cn'], paths: ['/jyxxgc/index.jhtml', '/jyxxgg/index.jhtml'] },
  { name: '陕西公共资源', kind: 'coal', hosts: ['https://www.sxbid.com.cn', 'http://www.sxbid.com.cn'], paths: ['/', '/jyxx/001001/001001001/'] },
  { name: '国信e采', kind: 'coal', hosts: ['https://www.e-bidding.org.cn', 'https://www.e-bidding.com'], paths: ['/'] },
  { name: '必联网', kind: 'coal', hosts: ['https://www.ebnew.com'], paths: ['/'] },
  { name: '中电投电子商务', kind: 'coal', hosts: ['https://www.cdt-ec.com'], paths: ['/'] },
  { name: '兖矿能源采购', kind: 'coal', hosts: ['https://www.yzmine.com', 'https://www.yankuang.com'], paths: ['/'] },
  { name: '河南能源电子采购', kind: 'coal', hosts: ['https://www.hnenergy.com.cn', 'https://hbmy coal.com'], paths: ['/'] },
  { name: '贵州盘江煤电', kind: 'coal', hosts: ['https://www.pjcoal.com', 'https://www.panjiang.com.cn'], paths: ['/'] },
  { name: '云南能投采购', kind: 'coal', hosts: ['https://www.ynnyjt.com', 'https://www.yneq.com.cn'], paths: ['/'] },
  { name: '四川川煤招标', kind: 'coal', hosts: ['https://www.sccm.cn', 'https://www.sccm-tender.com'], paths: ['/'] },
  { name: '新疆能源采购', kind: 'coal', hosts: ['https://www.xjny.com.cn', 'https://www.xjygsun.com'], paths: ['/'] },

  // ===== 竞品官网 14 家（AGENTS.md 在册）=====
  { name: '天津美腾', kind: 'vendor', hosts: ['https://www.tjmt.com.cn', 'http://www.tjmt.com.cn', 'https://www.meiteng-group.com', 'https://www.tjmt.com'], paths: ['/', '/news/', '/news.html'] },
  { name: '唐山神州机械', kind: 'vendor', hosts: ['http://www.tsshenzhou.com', 'https://www.tsshenzhou.com', 'http://www.szmc.com.cn'], paths: ['/xinwen/', '/', '/xwzx/gsxw/'] },
  { name: '威海海王科技', kind: 'vendor', hosts: ['http://www.haiwang.com.cn', 'https://www.haiwang.com.cn'], paths: ['/', '/news/'] },
  { name: '霍里思特', kind: 'vendor', hosts: ['https://www.holysort.com', 'http://www.holysort.com'], paths: ['/', '/news/', '/news.html'] },
  { name: '枣庄海纳', kind: 'vendor', hosts: ['http://www.haina2001.com', 'https://www.haina2001.com'], paths: ['/', '/gsxw/N.html', '/gsxw/'] },
  { name: '丹东东方测控', kind: 'vendor', hosts: ['http://www.dfmc.com.cn', 'https://www.dfmc.com.cn'], paths: ['/', '/shichangxinwen/', '/market/'] },
  { name: '合肥奥博特', kind: 'vendor', hosts: ['https://www.abtrobot.com', 'http://www.abtrobot.com', 'https://www.aobote.com'], paths: ['/', '/?catID=2', '/news/'] },
  { name: '湖北金石智能装备', kind: 'vendor', hosts: ['https://www.jinshisort.com', 'http://www.jinshisort.com'], paths: ['/', '/news/', '/news/1/'] },
  { name: '河北澳兰机械', kind: 'vendor', hosts: ['http://www.aolan.com.cn', 'https://www.aolan.com.cn', 'http://www.hbaolan.com', 'https://www.hb-aolan.com'], paths: ['/'] },
  { name: '湖南升华智选', kind: 'vendor', hosts: ['http://www.shenghua-se.com', 'https://www.shenghua-se.com', 'http://www.shzx.com.cn', 'https://www.hnshzx.com'], paths: ['/', '/news/'] },
  { name: '同方威视', kind: 'vendor', hosts: ['https://www.nuctech.com', 'http://www.nuctech.com'], paths: ['/', '/news/'] },
  { name: '赣州吉瑞机械', kind: 'vendor', hosts: ['http://www.jiruijx.com', 'https://www.jiruijx.com', 'http://www.jiruimachine.com'], paths: ['/'] },
  { name: '赣州好朋友科技', kind: 'vendor', hosts: ['http://www.gzfriend.com', 'https://www.gzfriend.com', 'http://www.haopyouyou.com', 'http://www.gzfriendtech.com'], paths: ['/'] },
  { name: '合肥泰禾卓海', kind: 'vendor', hosts: ['http://www.chinataiho.com', 'https://www.chinataiho.com', 'http://www.taihezhuohai.com'], paths: ['/', '/news/'] },
];

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"');
}
const clean = raw => decodeEntities(String(raw).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function extractItems(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*?)href=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = `${m[1]} ${m[3]}`;
    const tAttr = attrs.match(/\btitle=["']([^"']{8,300})["']/i)?.[1]?.trim() || '';
    const tText = clean(m[4]);
    const title = tAttr.length >= 8 ? tAttr : tText;
    if (!title || title.length < 8 || /^[\d\s\-/.年月日]+$/.test(title)) continue;
    let url; try { url = new URL(m[2], base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    out.push({ title, url });
  }
  return out;
}

const NOTICE = /公告|招标|中标|采购|询价|询比价|结果|候选人|公示|谈判|磋商|比选/;
const DEVICE = /干选|干法选煤|干法分选|干法提质|复合干选|XRT|射线[^，。]{0,6}(分选|拣选)|光电分选|智能[^，。；\s]{0,4}(分选|拣选|选矸)|分选机|选矸机|色选机|跳汰机|重介分选/;

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA, referer: new URL(url).origin },
      redirect: 'follow', signal: ctrl.signal,
    });
    return { status: r.status, html: await r.text(), finalUrl: r.url };
  } finally { clearTimeout(timer); }
}

// 重试：网络类错误才算失败重试，HTTP 4xx/5xx 不重试
async function probeUrl(url) {
  let lastErr = '';
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const { status, html, finalUrl } = await fetchOnce(url);
      const out = { url, finalUrl, status, attempts: attempt, links: 0, notices: 0, deviceHits: [], reason: '' };
      if (status === 403 || status === 401) { out.reason = `HTTP ${status}（需登录或被拒）`; return out; }
      if (status >= 400) { out.reason = `HTTP ${status}（URL 可能不对）`; return out; }
      if (/antispider|请输入验证码|访问过于频繁|unusual traffic|安全验证/i.test(html)) {
        out.reason = '反爬/验证码拦截'; return out;
      }
      const items = extractItems(html, finalUrl);
      out.links = items.length;
      out.notices = items.filter(i => NOTICE.test(i.title)).length;
      out.deviceHits = items.filter(i => DEVICE.test(i.title)).slice(0, 5).map(i => i.title.slice(0, 60));
      const visible = clean(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
      out.visibleChars = visible.length;
      if (out.links === 0 && visible.length < 400) {
        out.reason = '无链接且正文极少 → JS 渲染，需浏览器抓取'; return out;
      }
      if (out.links === 0) { out.reason = '能访问但提取不到链接'; return out; }
      out.ok = true;
      return out;
    } catch (e) {
      lastErr = e.name === 'AbortError' ? '超时' : e.message;
      if (attempt < RETRIES) {
        console.log(`     (${attempt}/${RETRIES} ${url.slice(0, 55)} → ${lastErr}，重试)`);
        await new Promise(r => setTimeout(r, 3000 * attempt));
      }
    }
  }
  return { url, ok: false, status: 0, links: 0, notices: 0, deviceHits: [], reason: `重试${RETRIES}次仍失败：${lastErr}` };
}

const report = [];
for (const c of CANDIDATES) {
  console.log(`\n=== ${c.name} (${c.kind}) ===`);
  const tries = [];
  let best = null;
  for (const host of c.hosts) {
    for (const p of c.paths) {
      const url = host + p;
      const r = await probeUrl(url);
      tries.push(r);
      const tag = r.ok ? (r.deviceHits.length ? '✓ 有设备相关' : '○ 有公告无设备项') : '✗';
      console.log(`  ${tag} HTTP${r.status || '-'} 链接${r.links} 公告${r.notices} ${r.reason || ''} ${url.slice(0, 62)}`);
      r.deviceHits.slice(0, 2).forEach(t => console.log(`        · ${t}`));
      if (r.ok && (!best || r.deviceHits.length > best.deviceHits.length)) best = r;
      if (r.ok && r.deviceHits.length) break;   // 找到有货的就够了
    }
    if (best && best.deviceHits.length) break;
  }
  const okAny = tries.some(r => r.ok);
  const devAny = tries.some(r => r.deviceHits.length);
  console.log(okAny ? (devAny ? '  → 可接入（有相关公告）' : '  → 可接入（当期无货）') : '  → 抓不到');
  report.push({ name: c.name, kind: c.kind, reachable: okAny, hasDevice: devAny, best: best && best.url, tries });
}

mkdirSync('reports', { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  total: report.length,
  reachable: report.filter(r => r.reachable).length,
  withDevice: report.filter(r => r.hasDevice).length,
  unreachable: report.filter(r => !r.reachable).map(r => r.name),
  notReady: report.filter(r => r.reachable && !r.hasDevice).map(r => r.name),
};
writeFileSync(OUT, JSON.stringify({ summary, platforms: report }, null, 2) + '\n', 'utf8');
console.log(`\n\n==== 汇总 ====`);
console.log(`候选 ${summary.total} / 可访问 ${summary.reachable} / 当期有设备相关 ${summary.withDevice}`);
console.log(`抓不到(${summary.unreachable.length}): ${summary.unreachable.join('、') || '无'}`);
console.log(`报告: ${OUT}`);
