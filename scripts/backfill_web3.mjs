// 回填：9条未披露的原因标注 + WebSearch已确认的各家候选报价
import { readFileSync, writeFileSync } from 'node:fs';
const FLAT = 'src/data/intelligence.flat.json';
const d = JSON.parse(readFileSync(FLAT, 'utf8'));
function find(sub) { return d.find(r => (r.title || '').includes(sub)); }
function setBids(sub, bids) {
  const r = find(sub);
  if (!r) { console.log('!! 未找到:', sub); return; }
  // 仅在尚无 bids 时写入（避免覆盖 enrich 脚本结果）
  if (!r.bids || !r.bids.length) {
    r.bids = bids;
    if (r.competitor && /（第一候/.test(r.competitor) && bids[0]) r.competitor = bids[0].company;
    console.log('  bids 已写:', sub.slice(0, 24), '->', bids.length, '家');
  } else {
    console.log('  已有 bids(保留):', sub.slice(0, 24));
  }
}

// ===== 1) WebSearch 已确认的候选报价 =====
setBids('新疆中富矿业', [
  { rank: 1, company: '天津美腾科技股份有限公司', quote: '279.13万元', quoteYuan: 2791300 },
  { rank: 2, company: '唐山神州机械集团有限公司', quote: '269万元', quoteYuan: 2690000 },
]);
setBids('宁夏煤业汝箕沟', [
  { rank: 1, company: '威海市海王科技有限公司', quote: '305万元', quoteYuan: 3050000 },
  { rank: 2, company: '唐山神州机械集团有限公司', quote: '307.58万元', quoteYuan: 3075800 },
]);
setBids('内蒙古蒙东能源', [
  { rank: 1, company: '唐山神州机械集团有限公司', quote: '1067.58万元', quoteYuan: 10675800 },
  { rank: 2, company: '威海市海王科技有限公司', quote: '1100.0028万元', quoteYuan: 11000028 },
]);
// 准能配件：中标候选人公示(2026-01-08)，第一候选 259.67万
setBids('准能集团振动筛和干选机及过滤机配件', [
  { rank: 1, company: '青岛金盛万豪机械设备有限公司', quote: '259.67万元', quoteYuan: 2596779.61 },
  { rank: 2, company: '河北澳德工业设备有限公司', quote: '292.13万元', quoteYuan: 2921264.57 },
]);
// 给准能配件记录补金额（原未披露）
{
  const r = find('准能集团振动筛和干选机及过滤机配件');
  if (r && (!r.amount || /未披露/.test(r.amount))) { r.amount = '259.67万元'; r.amountNote = '第一中标候选报价(配件总包，含振动筛/干选机/过滤机配件24+51项)'; r.winner = '青岛金盛万豪机械设备有限公司'; r.bidStatus = '中标候选人'; console.log('  准能配件金额回填:', r.amount); }
}

// ===== 2) 9条未披露的原因标注（深挖结论，非偷懒） =====
function note(sub, amountNote, extra = {}) {
  const r = find(sub); if (!r) { console.log('!! 未找到:', sub); return; }
  r.amountNote = amountNote;
  Object.assign(r, extra);
  console.log('  标注:', sub.slice(0, 22), '|', amountNote.slice(0, 30));
}
// 党家河：设备招标2026-04-24因不足三家流标失败；土建施工劳务询比价(金额未公开)
note('建设公司天宏钢构鹤壁煤业', '党家河TDS智能干选系统设备招标2026-04-24因投标人不足三家流标失败；土建施工劳务询比价(2026-07-18)金额未公开(中原云商)', { competitor: '（设备招标流标，未授标）' });
// 党家河异常公告（流标）单独标注
{ const r = find('鹤壁煤业(集团)有限责任公司设备采购党家河TDS智能干选系统异常公告'); if (r) { r.amountNote = '设备招标失败(不足三家)，项目尚未授标'; r.competitor = '（流标，无中标方）'; } }
// 胜利能源：中标结果公告(2026-07-20)中标人栏为"无"
note('胜利能源坑下干选系统移设改造', '中标结果公告(2026-07-20)中标人栏为"无"，项目未成功授标（EPC式移设改造，含勘察设计+设备拆运安+土建）', { competitor: '（中标人：无）' });
// 玲珑：开标2026-07-28，结果未出
note('山东黄金矿业（玲珑）有限公司光电智能分选机', '招标公告(2026-07-07)，开标2026-07-28 09:00，截至2026-07-31中标结果尚未公示（金矿XRT光电分选，新增/扩容设备）', { competitor: '（待开标结果）', amountNote: '招标公告(2026-07-07)，开标2026-07-28 09:00，截至2026-07-31中标结果尚未公示（金矿XRT光电分选，新增/扩容设备）' });
// 淮北美腾配件：单一来源直接采购
note('淮北矿业股份有限公司天津美腾科技', '天津美腾科技智能干选机主机配件直接采购公示(2026-05-07，单一来源)，金额未公示', { competitor: '天津美腾科技股份有限公司' });
// 正升设计：企业自主采购非招标设计项目
note('山西汾西正升煤业有限责任公司动筛车间改造和智能干选系统改造设计', '企业自主采购非招标设计项目(2026-07-27)，设备金额待后续招标公告', { competitor: '（设计阶段，未定设备商）' });
// 北京华宇实验室工程：竞争性谈判，公告未披露金额
note('中煤科工集团北京华宇工程有限公司《块煤智能干选技术与装备的研究》实验室工程', '北京华宇自研实验室工程(竞争性谈判HYCG-2025-GC-571，北京门头沟，工期25天)，公告未披露金额', { competitor: '中煤科工集团北京华宇工程有限公司' });

writeFileSync(FLAT, JSON.stringify(d, null, 2));
console.log('\n回填完成。');
