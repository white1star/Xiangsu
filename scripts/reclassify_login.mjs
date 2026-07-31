// reclassify_login.mjs
// 依据 2026-07-31 实测复核：以下平台的“招标公告/中标公示”均可在未登录状态下直接查看，
// 仅“下载招标文件 / 投标”需供应商注册。按既定口径“公告可看即算公开”，将此前误标为“需登录”的条目纠正。
// 数据层事实：flat 中 18 条 sourceAuthority=需登录 全部来自下列平台，无一来自真正登录墙后平台（如中煤易购/电建/能建/华电/大唐/山东能源/淮河能源）。
import fs from 'fs';
const f = 'src/data/intelligence.flat.json';
const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
const map = [
  ['山东产权', '官方公开'], // 全国公共资源交易平台（山东产权交易中心综合交易系统）
  ['淮北矿业', '公开'],     // 淮北矿业电子招标采购平台 / 电子商务采购平台
  ['华能', '公开'],         // 中国华能集团电子招投标系统
  ['国能e招', '公开'],
  ['中国煤科', '公开'],     // 中国煤科电子采购平台
  ['神华招标网', '公开'],   // 神华已并入国能，公告在国能e招公开
  ['鞍钢', '公开'],         // 鞍钢集团电子招标投标交易平台
];
let n = 0, unmatched = [];
for (const e of arr) {
  if (e.sourceAuthority === '需登录' && e.source) {
    const hit = map.find(([kw]) => e.source.includes(kw));
    if (hit) { e.sourceAuthority = hit[1]; n++; }
    else unmatched.push(e.source);
  }
}
fs.writeFileSync(f, JSON.stringify(arr, null, 2) + '\n');
const cnt = {};
for (const e of arr) cnt[e.sourceAuthority] = (cnt[e.sourceAuthority] || 0) + 1;
console.log('已纠正需登录→公开/官方公开:', n, '条');
if (unmatched.length) console.log('⚠ 未匹配(保留需登录):', unmatched);
console.log('新 sourceAuthority 分布:', cnt);
