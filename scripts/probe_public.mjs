// 探查：用特征词在 ggzy 全国公开站搜索这 8 个"消失项目"的公开版公告（只读，不写盘）
import { UA, sleep } from './amount-lib.mjs';

const QUERIES = [
  '汪家寨 智能干选系统',
  '党家河 TDS 智能干选',
  '红四煤矿 煤矸分离 智能干选机',
  '红会第一煤矿 智能干选系统',
  '漳村煤矿 智能干选机 维保',
  '兰阿煤业 干法选煤',
  '正升煤业 智能干选系统改造',
  '坪上煤业 TDS 智能干选',
];
const API = 'https://www.ggzy.gov.cn/information/pubTradingInfo/getTradList';
const WINDOW = { from: '2025-08-05', to: '2026-07-31' };

async function search(q) {
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
      if (res.status !== 200) { console.log(`   HTTP ${res.status}`); break; }
      const p = JSON.parse(await res.text());
      if (p.code === 829) { console.log('   验证码限流'); break; }
      if (p.code !== 200) { console.log(`   code ${p.code}`); break; }
      totalPages = p.data.pages || 1;
      for (const r of p.data.records || []) {
        const path = String(r.url || '');
        if (!path) continue;
        out.push({
          title: String(r.title || '').trim(),
          url: `https://www.ggzy.gov.cn${path.replace('/html/a/', '/html/b/')}`,
          date: String(r.publishTime || '').slice(0, 10).replace(/\//g, '-'),
          platform: r.transactionSourcesPlatformText || r.provinceText || '国家级',
        });
      }
    } catch (e) { console.log(`   ${e.message}`); break; }
    await sleep(1200);
  }
  return out;
}

const KW = /干选|选矸|分选|煤矸|TDS|XRT|智选/i;
for (const q of QUERIES) {
  console.log(`\n>> ${q}`);
  const hits = await search(q);
  const fresh = hits.filter(h => KW.test(h.title));
  console.log(`   命中 ${hits.length} 条，关键词相关 ${fresh.length} 条`);
  fresh.forEach(h => console.log(`   ${h.date} | ${h.platform} | ${h.title.slice(0, 48)}`));
}
console.log('\n==== 探查结束 ====');
