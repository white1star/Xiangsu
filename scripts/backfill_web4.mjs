// 回填第二批候选报价 + 新增簸箕掌项目
import { readFileSync, writeFileSync } from 'node:fs';
const FLAT = 'src/data/intelligence.flat.json';
const d = JSON.parse(readFileSync(FLAT, 'utf8'));
function find(sub) { return d.find(r => (r.title || '').includes(sub)); }
function setBids(sub, bids, extra = {}) {
  const r = find(sub); if (!r) { console.log('!! 未找到:', sub); return; }
  if (!r.bids || !r.bids.length) {
    r.bids = bids;
    if (r.competitor && /（第一候/.test(r.competitor) && bids[0]) r.competitor = bids[0].company;
    console.log('  bids 已写:', sub.slice(0, 22), bids.length, '家');
  } else { console.log('  已有bids(保留):', sub.slice(0, 22)); }
  Object.assign(r, extra);
}

setBids('红会第一煤矿分公司智能干选系统PC总承包', [
  { rank: 1, company: '甘肃煤炭第一工程有限责任公司', quote: '1643.15万元', quoteYuan: 16431464.99 },
  { rank: 2, company: '纵揽建设发展有限公司', quote: '1643.62万元', quoteYuan: 16436201.28 },
  { rank: 3, company: '义峰建设投资集团有限公司', quote: '1643.88万元', quoteYuan: 16438759.08 },
], { amountNote: 'PC总承包（含设备+土建+安装），三家报价极差仅约2.7万，竞争胶着' });

setBids('保德选煤厂智能干选改造项目(EPC)设计、采购及施工总承包智能干选机采购', [
  { rank: 1, company: '霍里思特科技（浙江）有限公司', quote: '754万元', quoteYuan: 7540000 },
  { rank: 2, company: '合肥泰禾卓海智能科技有限公司', quote: '795万元', quoteYuan: 7950000 },
  { rank: 3, company: '河南恒冠卓科技有限公司', quote: '780.8万元', quoteYuan: 7808000 },
]);

setBids('金河煤矿智能干选系统采购项目', [
  { rank: 1, company: '枣庄海纳科技有限公司', quote: '316万元', quoteYuan: 3160000 },
  { rank: 2, company: '威海市海王科技有限公司', quote: '336.6万元', quoteYuan: 3366000 },
  { rank: 3, company: '甘肃卓越智能工矿物资有限公司', quote: '344万元', quoteYuan: 3440000 },
]);

setBids('大南湖一矿原煤干选系统建设项目', [
  { rank: 1, company: '中煤建筑安装工程集团有限公司', quote: '6878.60万元', quoteYuan: 68786031.28 },
  { rank: 2, company: '大地工程开发（集团）有限公司', quote: '6988.12万元', quoteYuan: 69881183.39 },
], { amountNote: 'EPC整体价（含块煤智能干选车间土建+设备+安装），非单纯设备价' });

// 中富：补第3名海王258万
{
  const r = find('新疆中富矿业');
  if (r && r.bids) { r.bids.push({ rank: 3, company: '威海市海王科技有限公司', quote: '258万元', quoteYuan: 2580000 }); console.log('  中富补第3名: 海王258万'); }
}

// 保德EPC总包：补第2名石家庄设计院2109.28万
setBids('保德选煤厂智能干选改造(EPC)公开招标', [
  { rank: 1, company: '中煤科工集团沈阳设计研究院有限公司', quote: '2046.74万元', quoteYuan: 20467416.70 },
  { rank: 2, company: '煤炭工业石家庄设计研究院有限公司', quote: '2109.28万元', quoteYuan: 21092800.00 },
], { amountNote: 'EPC总包（设计+采购+施工），设备分包另计霍里思特754万' });

// 冀中12标包
setBids('冀中能源股份有限公司2026年度设备采购第四批', [
  { rank: 1, company: '唐山神州机械集团有限公司', quote: '318万元', quoteYuan: 3179999.67 },
  { rank: 2, company: '枣庄海纳科技有限公司', quote: '349.95万元', quoteYuan: 3499500.39 },
  { rank: 3, company: '霍里思特科技（浙江）有限公司', quote: '419.68万元', quoteYuan: 4196820 },
]);

// 华亭山寨：补第2候选（无报价）
{
  const r = find('山寨煤矿末煤干选设备租赁委外运营');
  if (r && r.bids) { r.bids.push({ rank: 2, company: '锡林郭勒盟神工制造有限公司', quote: '（未公示）', quoteYuan: null }); console.log('  华亭山寨补第2候选: 神工制造'); }
}

// 西黑山：标注最高限价
{
  const r = find('西黑山一号矿井选煤厂EPC总承包项目智能干选机设备');
  if (r) { r.amountNote = (r.amountNote ? r.amountNote + '；' : '') + '招标公告最高限价1063.7万元（中标价即顶限）'; console.log('  西黑山标注最高限价'); }
}

// 新增：簸箕掌煤业智能干选设备采购（第2次招标，山西招标公共服务平台公开源）
d.push({
  id: 'auto-baojizhang-' + Date.now(),
  title: '山西煤炭运销集团簸箕掌煤业有限责任公司智能干选设备采购（第2次招标）中标结果公示',
  source: '山西省招标投标公共服务平台（公开镜像）',
  sourceAuthority: '公开',
  bidStatus: '中标结果',
  bid: '已中标',
  date: '2026-06-02',
  publishDate: '2026-06-02',
  region: '山西·大同',
  line: '煤炭智能干选设备',
  competitor: '枣庄海纳科技有限公司',
  winner: '枣庄海纳科技有限公司',
  amount: '856万元',
  amountNote: '第2次招标中标价；第1次招标流标',
  confidence: '高',
  url: 'https://www.dlnyzb.com/detail/40537245',
  evidence: '中标候选人：1枣庄海纳8560000元 2威海市海王8000000元 3河北玖河精密机械8380000元',
  bids: [
    { rank: 1, company: '枣庄海纳科技有限公司', quote: '856万元', quoteYuan: 8560000 },
    { rank: 2, company: '威海市海王科技有限公司', quote: '800万元', quoteYuan: 8000000 },
    { rank: 3, company: '河北玖河精密机械制造有限公司', quote: '838万元', quoteYuan: 8380000 },
  ],
});
console.log('  新增簸箕掌项目(海纳856万)');

writeFileSync(FLAT, JSON.stringify(d, null, 2));
console.log('\n回填完成。当前 flat 条数:', d.length);
