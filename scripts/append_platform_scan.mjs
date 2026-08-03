// 新增3平台（晋能控股/新疆阳光/十环）地毯扫描落库（2026-08-03）
// 结果：竞品整机中标 0 新增，仅莲盛 IDS-2400 外委招标线索 1 条可收
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));
const mkId = u => 'auto-' + Buffer.from(u).toString('base64').replace(/=+$/, '').slice(0, 22);
const now = new Date().toISOString();

const news = [
  {
    title: '莲盛智能煤矸石分选系统(IDS-2400)筛选运维及矸石破碎倒运外委承包(2026)招标公告',
    url: 'https://dzzb.jnkgjtdzzbgs.com/cms/default/webfile/2ywgg1/20260707/1259190144250937344.html',
    source: '晋能控股招标采购平台', publishDate: '2026-07-07',
    line: '煤炭智能干选设备', bid: '招标公告', bidStatus: '招标公告',
    region: '山西·朔州（平鲁）', sourceAuthority: '官方公开',
    amount: '未披露', amountNote: '外委承包招标未披露预算；2026-07-07首次招标、07-22二次招标，未定标',
    confidence: '高',
    evidence: '晋能控股招标采购平台莲盛智能煤矸石分选系统(IDS-2400)筛选运维及矸石破碎倒运外委承包(2026)招标（2026-07-07首招、2026-07-22二次招标）：莲盛煤业（朔州平鲁）智能煤矸石分选系统为存量设备（IDS-2400），本次为筛选运维及矸石破碎倒运外委承包招标，尚未定标。',
    competitor: '未定标',
    buyer: '莲盛煤业（朔州平鲁）', mineral: '煤', date: '2026-07-07'
  }
];

const exists = new Set(data.map(d => d.title));
let n = 0;
for (const r of news) {
  if (exists.has(r.title)) { console.log('跳过已存在:', r.title.slice(0, 25)); continue; }
  data.push({ ...r, procurement: r.amountNote || '', evidenceCapturedAt: now, id: mkId(r.url) });
  exists.add(r.title); n++;
}
writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log('新增平台扫描追加', n, '条，平铺台账现有', data.length, '条');
