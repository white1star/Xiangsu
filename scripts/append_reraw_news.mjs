// 新口径全量重扒落库（2026-08-03）：43公开+3登录后免费可看(必联网/中国招标网/剑鱼) 重扒新增
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));
const mkId = u => 'auto-' + Buffer.from(u).toString('base64').replace(/=+$/, '').slice(0, 22);
const now = new Date().toISOString();

const news = [
  {
    title: '宁夏煤业洗选中心2026年4月分选设备配件（枣庄海纳科技）单一来源采购结果公告',
    url: 'https://m.zhaobiao.cn/zb/bidding_v_42a91c724661c5e778fa3f80754817d0.html',
    source: '中国招标网（国家能源e购单一来源公告）', publishDate: '2026-05-12',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '宁夏', sourceAuthority: '官方公开',
    amount: '未披露', amountNote: '单一来源采购（原厂后续零配件），金额未披露',
    confidence: '高',
    evidence: '宁夏煤业洗选中心2026年4月分选设备配件（枣庄海纳科技）单一来源采购结果（2026-05-12，WZYC-WZDY-2026050076）：国家能源集团宁夏煤业在用海纳ART-1.4风力分选机，按"原厂后续零配件"单一来源续供（执行气缸组/引导式分选板/缓冲阻尼液压缸体等），海纳持续绑定宁夏存量装机。',
    competitor: '枣庄海纳科技有限公司', winner: '枣庄海纳科技有限公司',
    buyer: '国家能源集团宁夏煤业有限责任公司（洗选中心）', mineral: '煤', date: '2026-05-12'
  },
  {
    title: '崇信县百贯沟煤业有限公司手选皮带TDS智能选矸系统采购及安装招标公告',
    url: 'https://www.ebnew.com/businessShow/709326104.html',
    source: '必联网（登录后免费可看）', publishDate: '2026-08-01',
    line: '煤炭智能干选设备', bid: '招标公告', bidStatus: '招标公告',
    region: '甘肃·平凉（崇信）', sourceAuthority: '公开',
    amount: '未披露', amountNote: '招标公告未披露预算（金额需登录查看）；8月新发布，未定标',
    confidence: '中',
    evidence: '必联网2026-08-01发布崇信县百贯沟煤业有限公司手选皮带TDS智能选矸系统采购及安装招标公告：采购智能干选机及干选系统供货安装（含溜槽、配电、除尘），要求投标人具备智能干选工艺系统施工业绩。8月新订单窗口，未定标。',
    competitor: '未定标',
    buyer: '崇信县百贯沟煤业有限公司', mineral: '煤', date: '2026-08-01'
  },
  {
    title: '河南神火国贸X射线矿石智能分选机配件（SHGM-20260405-029）中标公告',
    url: 'https://www.chinamae.com/partner/11773fcb2897518394f8edeb9d3f3e00.html',
    source: '神火招标采购平台（chinamae公开镜像）', publishDate: '2026-04-20',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '河南·许昌（刘河选煤厂）', sourceAuthority: '公开',
    amount: '未披露', amountNote: '配件中标公告未披露金额',
    confidence: '高',
    evidence: '河南神火国贸X射线矿石智能分选机配件（SHGM-20260405-029）中标公告（2026-04-20）：神火刘河选煤厂在用霍里思特X射线分选机，SMC气缸/推板/同步带等原厂配件由霍里思特直供，确认刘河存量装机绑定。',
    competitor: '霍里思特', winner: '霍里思特',
    buyer: '河南神火国贸有限公司（刘河选煤厂）', mineral: '煤', date: '2026-04-20'
  },
  {
    title: '思茅山水保护盖等配件采购项目公开询比价公告（好朋友设备配件）',
    url: 'https://rl.zhaobiao.cn/bidding_v_a9c80db4f725047dc10fb329aa9d0756.html',
    source: '中国招标网（中铜国际询比价公告）', publishDate: '2026-03-03',
    line: '矿石XRT光电分选设备', bid: '招标公告', bidStatus: '招标公告',
    region: '云南·普洱（思茅）', sourceAuthority: '公开',
    amount: '未披露', amountNote: '询比价公告未披露金额；仅询价阶段未见成交公告',
    confidence: '中',
    evidence: '中铜国际贸易集团思茅山水保护盖等配件采购项目（赣州好朋友科技有限公司设备配件）公开询比价公告（2026-03-03）：针对好朋友设备专项采购配件，提示好朋友在云南中铜系（思茅山水铜矿）形成装机。询价阶段，未定标。',
    competitor: '未定标',
    buyer: '中铜国际贸易集团（云南思茅山水铜矿）', mineral: '铜', date: '2026-03-03'
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
console.log('全量重扒追加', n, '条，平铺台账现有', data.length, '条');
