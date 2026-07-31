// normalize_intel.mjs —— 将 scrape33 输出的 intelligence.new.json 归一化后写入正式数据文件。
// 补齐前端所需字段（bid/date/openStatus/competitor/confidence），去重，按日期倒序。
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'src/data/intelligence.new.json';
const DST = 'src/data/intelligence.json';
const TODAY = '2026-07-31';

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const seenUrl = new Set();
const seenId = new Set();
const out = [];

for (const r of raw) {
  const rec = { ...r };
  // 字段补齐
  rec.bid = rec.bid || rec.bidStatus || '未披露';
  rec.bidStatus = rec.bidStatus || rec.bid;
  rec.date = rec.date || rec.publishDate || '';
  rec.publishDate = rec.publishDate || rec.date || '';
  rec.competitor = rec.competitor || '未披露';
  rec.confidence = rec.confidence || '高';
  rec.amount = rec.amount || '未披露';
  rec.region = rec.region || '待核实';
  if (rec.bid === '招标公告' && rec.bidOpenDate && !rec.openStatus) {
    rec.openStatus = rec.bidOpenDate <= TODAY ? '已开标' : '待开标';
  }
  if (!rec.id || seenId.has(rec.id)) {
    rec.id = 'auto-' + Buffer.from(rec.url || rec.title || String(Math.random())).toString('base64').replace(/[/+=]/g, '').slice(0, 28);
  }
  seenId.add(rec.id);
  const ukey = (rec.url || '').replace(/[?#].*$/, '');
  if (seenUrl.has(ukey)) continue; // 二次去重（按URL去query）
  seenUrl.add(ukey);
  out.push(rec);
}

// 按发布日期倒序
out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

writeFileSync(DST, JSON.stringify(out, null, 2));

const total = out.length;
const undisclosed = out.filter(r => /未披露/.test(r.amount)).length;
const byLine = {};
for (const r of out) byLine[r.line] = (byLine[r.line] || 0) + 1;
const byStatus = {};
for (const r of out) byStatus[r.bid] = (byStatus[r.bid] || 0) + 1;
console.log(`归一化完成：总 ${total} 条`);
console.log(`金额仍“未披露”： ${undisclosed} 条`);
console.log('按产品线：', byLine);
console.log('按状态：', byStatus);
const noBid = out.filter(r => !r.bid).length;
const noDate = out.filter(r => !r.date).length;
console.log(`缺 bid=${noBid} 缺 date=${noDate}`);
