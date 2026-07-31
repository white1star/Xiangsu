// 按"设备制造商"口径筛竞品：剔除设计院/工程总包/纯维修配件/工矿物资贸易类竞品公司，
// 仅保留 XRT·智能干选·光电分选设备制造商（与唐山像素智能科技有限公司构成竞品关系的）。
// 若某项目筛完后无任何设备制造商竞品且中标/候选方全为非设备商 -> 整条删除。
// 输入: src/data/intelligence.flat.json  输出: 同文件(就地修改) + 控制台打印待删清单
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(__dirname, '..', 'src', 'data', 'intelligence.flat.json');
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

// 非设备商：设计院 / 工程总包 / 纯维修配件 / 工矿物资贸易（与像素智能不构成设备竞品）
const NON_DEVICE = [
  '中煤天津设计', '中煤建筑安装', '中煤科工', '中煤第三建设', '中煤西安设计',
  '义峰建设', '圆之翰', '大地工程', '淮昊', '山冶鑫拓', '山西安畅', '宏厦',
  '惠安煤矿', '新龙建设', '宏远工程', '浙江中宇', '河南宝发', '湖南鑫毅',
  '石家庄设计研究院', '甘肃煤炭第一工程', '纵揽建设', '陕西普赛斯',
  '赛普瑞特', '柯宇', '金富电气', '卓越智能工矿物资'
];
const isNonDevice = c => NON_DEVICE.some(k => (c || '').includes(k));

// ---- projKey / keyOf / HINTS（与 group_projects.mjs 保持一致）----
function projKey(title) {
  let s = (title || '').replace(/[\[【\]】]/g, '').replace(/\s+/g, '');
  s = s.replace(/[（(](第?[一二三四五2-5]次(发询)?|日常采购|重新招标|\d+次)[)）]/g, '');
  s = s.replace(/重新招标|变更公告|\[?询比价采购\]?/g, '');
  const stage = /(中标（成交）结果公告|中标候选人公示|中标结果公[示告]|评标结果公示|候选人公示|中标公示|成交结果公告|成交公告|竞争性谈判公告|招标公告|采购公告|询价公告|结果公[示告]|中标|公示|公告)$/;
  let prev;
  do { prev = s; s = s.replace(stage, ''); } while (s !== prev);
  s = s.replace(/招标$/, '');
  s = s.replace(/[\s\-—_、，,。.·（）()]/g, '');
  return s;
}
const HINTS = [
  [/古城煤矿.*矿建工程/, 'HINT::潞安古城矿建工程'],
  [/古城煤矿.*设备安装/, 'HINT::潞安古城设备安装'],
  [/保德选煤厂智能干选改造/, 'HINT::神东保德干选改造EPC'],
  [/榆树岭煤矿.*TDS.*配件/, 'HINT::豫能榆树岭TDS配件年采'],
  [/金鼎公司金腾公司.*易损备件/, 'HINT::晋能金鼎干选机备件'],
  [/红会第一煤矿.*智能干选系统/, 'HINT::靖煤红会一矿干选PC总包'],
  [/山寨煤矿末煤干选设备租赁/, 'HINT::华能山寨末煤干选租赁'],
  [/陈家沟煤矿.*砚北煤矿.*配件/, 'HINT::华能陈家沟砚北配件'],
];
function keyOf(r) {
  const t = r.title || '';
  for (const [re, k] of HINTS) if (re.test(t)) return k;
  return projKey(t);
}

// 阶段A：过滤每条记录的 bids（去掉非设备商行）
for (const r of data) {
  if (Array.isArray(r.bids)) {
    r.bids = r.bids.filter(b => b && b.company && !isNonDevice(b.company));
    if (r.bids.length === 0) delete r.bids;
  }
}

// 阶段B：group 判定哪些项目应整条删除
const RANK = { '已中标': 3, '中标候选人': 2, '招标公告': 1, '招标计划': 1, '流标': 0 };
const rank = r => RANK[r.bid] || RANK[r.bidStatus] || 1;
const PLACEHOLDER = /未披露|尚未定标|无中标|待开标|流标|招标计划|成交结果|中标结果/;

const groups = new Map();
for (const r of data) {
  const k = keyOf(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const dropKeys = new Set();
for (const [k, arr] of groups) {
  // 取最高阶段、有竞品/中标人且非未披露的记录
  const compRec = arr.slice().sort((a, b) => rank(b) - rank(a)).find(r => {
    const c = (r.competitor || r.winner || '');
    return c && !/未披露/.test(c);
  });
  const rawComp = compRec ? (compRec.competitor || compRec.winner || '') : '';
  // 拆 token：按 、,，/ 分割，去括号内容，过滤占位符
  const tokens = rawComp.split(/[、,，/]/).map(t => t.trim().replace(/[（(].*?[)）]/g, '')).filter(Boolean).filter(t => !PLACEHOLDER.test(t));
  const allNonDevice = tokens.length > 0 && tokens.every(t => isNonDevice(t));
  // 该项目是否还有任何设备制造商竞品
  let hasDeviceBid = false;
  for (const r of arr) if (Array.isArray(r.bids)) for (const b of r.bids) if (b.company && !isNonDevice(b.company)) hasDeviceBid = true;
  if (allNonDevice && !hasDeviceBid) dropKeys.add(k);
}

console.log('待整条删除项目数:', dropKeys.size);
for (const k of dropKeys) console.log('  -', k.replace(/^HINT::/, ''));

// 阶段C：从 flat 中删除待删项目的全部记录
const before = data.length;
const kept = data.filter(r => !dropKeys.has(keyOf(r)));
console.log('flat 删除前:', before, '删除后:', kept.length);
writeFileSync(FLAT, JSON.stringify(kept, null, 2) + '\n');
