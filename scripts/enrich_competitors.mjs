// 竞品深挖：对每条含详情URL的记录，抓取详情页抽取"全部候选公司 + 各家报价"
// 输出：在原 flat 记录上写入 bids:[{rank,company,quote(万元),quoteYuan}] 与 specs(型号/能力)
import { readFileSync, writeFileSync } from 'node:fs';
import { UA, sleep, fetchSolid, htmlText, fmtAmount } from './amount-lib.mjs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

const NUM = '([\\d][\\d,，]{0,20}(?:\\.\\d+)?)';
const UNIT = '(万元|万|元)';
function toYuan(numStr, unit) {
  const n = parseFloat(String(numStr).replace(/[,，]/g, ''));
  if (!isFinite(n) || n <= 0) return null;
  if (unit === '万元' || unit === '万') return n * 10000;
  return n;
}
function plausible(yuan) {
  if (yuan == null) return false;
  if (yuan < 10000) return false;
  if (yuan > 1e10) return false;
  return true;
}
const cellText = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// 抽取候选表：名称列 + 报价列
function extractCandidates(html, body) {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const nameHeader = /(投标|供应|候选|中标|成交|单位|公司|投标|供应商|受托|成交人|中标人|厂商)\s*名称/;
  const priceHeader = /(投标报价|中标价|成交价|报价|中标金额|投标总价|评标价|最终报价|合同金额|投标报价|中标金额|总报价|投标(?!人)(?!单位))/;
  const out = [];
  for (const tb of tables) {
    const rows = tb.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) continue;
    let nameCol = -1, priceCol = -1, hr = -1, headerUnit = null;
    for (let i = 0; i < Math.min(rows.length, 4); i++) {
      const cells = (rows[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      cells.forEach((c, idx) => {
        if (nameCol < 0 && nameHeader.test(c) && c.length <= 16) nameCol = idx;
        if (priceCol < 0 && priceHeader.test(c) && c.length <= 20) { priceCol = idx; const hu = /[（(]\s*(万元|万|元)\s*[)）]/.exec(c); headerUnit = hu ? hu[1] : null; }
      });
      if (nameCol >= 0 || priceCol >= 0) { hr = i; break; }
    }
    if (nameCol < 0 && priceCol < 0) continue;
    for (let i = hr + 1; i < rows.length; i++) {
      const cells = (rows[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      // rowspan 造成列偏移，试原列与左移一列
      const nameCands = [];
      if (nameCol >= 0 && nameCol < cells.length) nameCands.push(cells[nameCol]);
      if (priceCol >= 0 && priceCol - 1 >= 0 && priceCol - 1 < cells.length) nameCands.push(cells[priceCol - 1]);
      const priceCands = [];
      if (priceCol >= 0 && priceCol < cells.length) priceCands.push(cells[priceCol]);
      const company = nameCands.find(v => v && /(公司|集团|研究院|厂|中心|所|大学|学院|局)/.test(v) && v.length >= 4 && v.length <= 50);
      let quoteYuan = null;
      for (const pc of priceCands) {
        if (!pc) continue;
        const m = new RegExp(NUM + '\\s*' + UNIT + '?').exec(pc);
        if (!m) continue;
        const unit = m[2] || headerUnit || (/万/.test(pc) ? '万元' : '元');
        const y = toYuan(m[1], unit);
        if (plausible(y)) { quoteYuan = y; break; }
      }
      if (company && quoteYuan) {
        out.push({ rank: out.length + 1, company: company.trim(), quoteYuan, quote: fmtAmount(quoteYuan) });
      }
    }
  }
  return out;
}

// 抽取设备规格/能力
function extractSpecs(body) {
  const specs = {};
  const cap = /处理能力[：:]\s*([\d,，]+)\s*(?:吨|t|t\/h|吨\/时|吨\/小时|tph)?/i.exec(body);
  if (cap) specs.capacity = cap[1].replace(/[,，]/g, '') + '吨/小时';
  const models = body.match(/(?:TDS|XRT|TT\d+|TGS|德矿|美腾|神州|霍里思特|海王|HX|MGS)\s*[-]?\s*[A-Za-z0-9\-]{2,12}/g) || [];
  if (models.length) specs.modelHits = [...new Set(models)].slice(0, 5);
  return specs;
}

let ok = 0, fail = 0;
const failedHosts = new Set();
for (const r of data) {
  const url = r.url;
  if (!url || !/^https?:\/\//.test(url)) continue;
  let host = '-'; try { host = new URL(url).host; } catch {}
  const res = await fetchSolid(url, { retries: 3, minBody: 400 });
  if (!res.ok) { fail++; failedHosts.add(host + ':' + res.err); continue; }
  const cands = extractCandidates(res.html, res.body);
  const specs = extractSpecs(res.body);
  if (cands.length) {
    r.bids = cands;
    // 若当前 competitor 只是截断字符串，用第一候选补全
    if (!r.competitor || /（第一候/.test(r.competitor)) {
      r.competitor = cands[0].company;
    }
    ok++;
  }
  if (Object.keys(specs).length) r.specs = specs;
  await sleep(500 + Math.random() * 400);
}
writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`候选抽取完成：成功写入 bids ${ok} 条，失败 ${fail} 条`);
console.log('失败来源:', [...failedHosts].slice(0, 12).join(' | '));
// 预览
const withBids = data.filter(r => r.bids && r.bids.length);
console.log(`\n含候选名单的记录 ${withBids.length} 条，示例：`);
withBids.slice(0, 6).forEach(r => {
  console.log('·', (r.title || '').slice(0, 30));
  r.bids.forEach(b => console.log(`   第${b.rank}名 ${b.company}  ${b.quote}`));
});
