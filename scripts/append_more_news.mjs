// 全网深挖结果落库（2026-08-03 第二轮补充）
// 操作：① 新增 6 条独立项目 + 4 条已收录项目的阶段补充
//       ② 更正：雷波小沟磷矿定标中标人为天津美腾（原记录泰禾卓海为评标并列第一候选人，改候选）
//       ③ 删除：中振建设智能选矸系统（中标人长治尚开工贸疑贸易商，按"纯贸易项目整条删"口径）
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));
const mkId = url => 'auto-' + Buffer.from(url).toString('base64').replace(/=+$/, '').slice(0, 22);
const now = new Date().toISOString();

// ---------- ③ 删除中振建设（中标方为贸易商，不符合"含设备制造商竞品"保留前提） ----------
const before = data.length;
const delIdx = data.findIndex(d => /中振建设/.test(d.title || ''));
if (delIdx >= 0) { data.splice(delIdx, 1); console.log('删除:', data.length === before - 1 ? '中振建设招标公告' : '异常'); }

// ---------- ② 更正雷波小沟磷矿：原泰禾卓海"已中标"→"中标候选人"（评标并列第一，未中标） ----------
const lp = data.find(d => /雷波县小沟磷矿采选工程光电分选机/.test(d.title || '') && d.bid === '已中标');
if (lp) {
  lp.bid = '中标候选人';
  lp.bidStatus = '中标候选人';
  delete lp.winner;
  lp.amountNote = '评标结果公示（2026-04-24）三家并列第一：天津美腾智能装备2479.3万/霍里思特科技(浙江)2523万/合肥泰禾卓海2468.6万；定标结果（2026-04-28集体决策）中标人为天津美腾智能装备';
  console.log('更正: 雷波小沟磷矿 泰禾卓海 已中标→中标候选人');
}

// ---------- ① 新增记录 ----------
const news = [
  // ===== 独立新项目 =====
  {
    title: '新疆哈密三塘湖能源开发建设有限责任公司石头梅一号露天煤矿830煤场机械选矸加工服务（二次）中标结果公示',
    url: 'https://www.xjygcg.com/jyxx/001001/001001004/20260706/596e508d-035e-493d-b022-ce4e5cdfe4d6.html',
    source: '新疆阳光采购平台', publishDate: '2026-07-06',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '新疆·哈密', sourceAuthority: '官方公开',
    amount: '3354.75万元', amountNote: '中标金额33547500.00元（机械选矸加工服务，工期50日历天+运营服务期18个月）',
    confidence: '高',
    evidence: '新疆阳光采购平台2026-07-06中标结果公示（招标编号NER-JT-FW/2026035G）：新疆哈密三塘湖能源开发建设有限责任公司石头梅一号露天煤矿830煤场机械选矸加工服务（二次），中标人唐山神州机械集团有限公司，中标金额33547500.00元，计划建设总工期合同签订后50日历天，运营服务期暂定18个月。',
    competitor: '唐山神州机械集团有限公司', winner: '唐山神州机械集团有限公司',
    buyer: '新疆哈密三塘湖能源开发建设有限责任公司', mineral: '煤', date: '2026-07-06'
  },
  {
    title: '唐山神州机械集团干法选煤技术闪耀蒙古：蒙古国胡硕图煤矿智慧化干法选煤厂投产',
    url: 'https://www.tsshenzhou.com/xinwen/20260116.html',
    source: '唐山神州机械集团官网新闻', publishDate: '2026-01-19',
    line: '煤炭智能干选设备', bid: '已投运', bidStatus: '已投运',
    region: '蒙古国（海外）', sourceAuthority: '官方自宣',
    amount: '未披露', amountNote: '官网新闻未披露项目金额（规划设计+设备供货+施工建设全流程）',
    confidence: '中',
    evidence: '唐山神州机械集团官网2026-01-19新闻：在"一带一路"框架下携手中煤天津设计院、蒙古能源公司，打造蒙古国胡硕图煤矿智慧化干法选煤厂（含设计、设备供货、施工全流程，AI视觉识别、全程无水、三级除尘）；2025-09-16集团董事长赴蒙古出席项目剪彩仪式，选煤厂正式投产运营。',
    competitor: '唐山神州机械集团有限公司', buyer: '蒙古能源公司（胡硕图煤矿）', mineral: '煤', date: '2026-01-19'
  },
  {
    title: '中国铁建股份有限公司设备集中招标智能分选设备采购项目中标公告（第1445号）',
    url: 'https://www.chinamae.com/partner/ea69c3fef1e962fd91953437c33844a6.html',
    source: '中国铁建设备集中招标公告', publishDate: '2026-03-13',
    line: '矿石XRT光电分选设备', bid: '已中标', bidStatus: '已中标',
    region: '北京（中国铁建集中招标）', sourceAuthority: '公开',
    amount: '未披露', amountNote: '公告未披露中标金额与矿种',
    confidence: '高',
    evidence: '中国铁建股份有限公司设备集中招标智能分选设备采购项目中标公告（招标编号CRCC-458999-18-1445，2026-03-13公示至03-15）：中标人赣州好朋友科技股份有限公司。公告未披露金额与矿种。',
    competitor: '赣州好朋友科技股份有限公司', winner: '赣州好朋友科技股份有限公司',
    buyer: '中国铁建股份有限公司', mineral: '未披露', date: '2026-03-13'
  },
  {
    title: '智能干选机配件(泰禾卓海)成交公告',
    url: 'https://www.ahtba.org.cn/site/trade/affiche/detail/f8da42f1-2f0a-11f1-b7f6-00163e1f3e9b',
    source: '安徽招标投标信息网', publishDate: '2026-04-03',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '安徽·淮南', sourceAuthority: '官方公开',
    amount: '未披露', amountNote: '配件成交公告未披露金额',
    confidence: '高',
    evidence: '安徽招标投标信息网2026-04-03成交公告：淮南矿业(集团)物资采供中心智能干选机配件(泰禾卓海)成交，供应商合肥泰禾卓海智能科技有限公司（存量干选机原厂配件，持续绑定淮南矿业）。',
    competitor: '合肥泰禾卓海智能科技有限公司', winner: '合肥泰禾卓海智能科技有限公司',
    buyer: '淮南矿业(集团)有限责任公司物资采供中心', mineral: '煤', date: '2026-04-03'
  },
  {
    title: '成都云图控股雷波基地光选机配件/备件系列采购中标（2026年1-5月共5批，霍里思特）',
    url: 'https://srm.wintrueholding.com/HomeSite/Site/NewsContentView?newsId=207304',
    source: '云图控股电子采购平台', publishDate: '2026-05-12',
    line: '矿石XRT光电分选设备', bid: '已中标', bidStatus: '已中标',
    region: '四川·凉山（雷波）', sourceAuthority: '官方公开',
    amount: '未披露', amountNote: '配件/备件采购均未披露金额',
    confidence: '高',
    evidence: '成都云图控股电子采购平台2026年雷波基地光选机配件/备件系列中标公告共5批，北京霍里思特科技有限公司均为中标供应商：2026-01-20光选机PCB控制板采购、02-27光选机采购（智能磷矿石分选机轴流风机、X10-CB控制板）、03-27光选机配件（邀请招标）、03-31光选设备备件、05-12光选机配件定点招标（编码器、UPS电源、分气缸等14项）——显示雷波磷矿在用霍里思特智能分选设备（存量装机）。',
    competitor: '霍里思特', winner: '霍里思特',
    buyer: '成都云图控股股份有限公司（雷波基地）', mineral: '磷', date: '2026-05-12'
  },
  {
    title: '甘肃新洲矿业有限公司90万吨/年钨矿光电预选项目设备购置中标公告',
    url: 'https://bid.10huan.com/2026/zb/0330/zb1774832750248028.html',
    source: '十环招标网（转引甘肃招标公告）', publishDate: '2026-03-30',
    line: '矿石XRT光电分选设备', bid: '已中标', bidStatus: '已中标',
    region: '甘肃', sourceAuthority: '公开',
    amount: '758万元', amountNote: '中标价格7580000.00元（标段编号zja2602260041001001）',
    confidence: '高',
    evidence: '甘肃新洲矿业有限公司90万吨/年钨矿光电预选项目设备购置中标公告（2026-03-30）：中标单位赣州吉瑞机械设备有限公司（统一社会信用代码91360703MACFUYYG6B），中标价格7580000.00元。（赣州系光电分选设备商，监测名单外新竞品）',
    competitor: '赣州吉瑞机械设备有限公司', winner: '赣州吉瑞机械设备有限公司',
    buyer: '甘肃新洲矿业有限公司', mineral: '钨', date: '2026-03-30'
  },
  // ===== 已收录项目的阶段补充 =====
  {
    title: '新疆天顺矿业有限公司2026年设备购置（第四批）成交公告',
    url: 'http://zb365.com.cn/cms/zgky/webfile/zd24=jsgczb/20260630/1256671046967230464.html',
    source: '中国(矿用)工业品电子招投标交易平台', publishDate: '2026-06-30',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '新疆·哈密', sourceAuthority: '官方公开',
    amount: '425万元', amountNote: '1标包（布料器、滚轴分级筛、智能干选机）成交价格4250000.06元',
    confidence: '高',
    evidence: '新疆天顺矿业有限公司2026年设备购置（第四批）成交公告（2026-06-30，开标2026-06-24）：1标包布料器、滚轴分级筛、智能干选机成交供应商威海市海王科技有限公司，成交价格4250000.06元，交货期自合同签订起30天内。（与台账2026-06-26成交候选人公示为同一项目）',
    competitor: '威海市海王科技有限公司', winner: '威海市海王科技有限公司',
    buyer: '新疆天顺矿业有限公司', mineral: '煤', date: '2026-06-30'
  },
  {
    title: '雷波县小沟磷矿采选工程光电分选机(第二次)设备采购光电分选机标段定标结果公示',
    url: 'https://ggzyjy.sc.gov.cn/jyxx/002001/002001008/20260429/08bf7983-73cc-426c-a3d4-aa3920407c3b.html',
    source: '四川省公共资源交易平台', publishDate: '2026-04-29',
    line: '矿石XRT光电分选设备', bid: '已中标', bidStatus: '已中标',
    region: '四川·凉山（雷波）', sourceAuthority: '官方公开',
    amount: '2479.30万元', amountNote: '中标金额24793000.00元（招标控制价2900万元）；定标时间2026-04-28，中标通知书2026-05-07',
    confidence: '高',
    evidence: '四川省公共资源交易平台2026-04-29定标结果公示：雷波县小沟磷矿采选工程光电分选机（第二次）设备采购光电分选机标段，中标单位天津美腾智能装备有限公司（归一化为天津美腾科技股份有限公司），中标金额24793000.00元，定标时间2026-04-28（招标人领导班子集体决策），中标通知书发出2026-05-07。评标结果（2026-04-24）三家并列第一：天津美腾智能装备2479.3万、霍里思特科技(浙江)2523万、合肥泰禾卓海2468.6万。（更正：台账原记泰禾卓海为中标人，实为定标落选）',
    competitor: '天津美腾科技股份有限公司', winner: '天津美腾科技股份有限公司',
    buyer: '四川发展天盛矿业有限公司', mineral: '磷', date: '2026-04-29'
  },
  {
    title: '宁夏煤业汝箕沟无烟煤分公司智能干选机设备采购中标结果公告',
    url: 'https://www.chnenergybidding.com.cn/bidweb/001/001006/001006001/20260525/cbcb74d7-e739-4844-bdb1-545076f0c43f.html',
    source: '国家能源招标网（国能e招）', publishDate: '2026-05-25',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '宁夏', sourceAuthority: '官方公开',
    amount: '305万元', amountNote: '中标结果公告（与台账2026-05-20候选公示为同一项目）',
    confidence: '高',
    evidence: '国家能源招标网2026-05-25中标结果公告：国家能源集团宁夏煤业有限责任公司汝箕沟无烟煤分公司智能干选机设备采购，中标人威海市海王科技有限公司，中标金额305万元。（与台账中标候选人公示2026-05-20为同一项目）',
    competitor: '威海市海王科技有限公司', winner: '威海市海王科技有限公司',
    buyer: '国家能源集团宁夏煤业有限责任公司汝箕沟无烟煤分公司', mineral: '煤', date: '2026-05-25'
  },
  {
    title: '[华能煤业公司华亭煤业陈家沟煤矿、砚北煤矿、煤炭智选公司智能干选机、破碎机、磁选机配件（限额以下）]中标结果公示',
    url: 'https://ec.chng.com.cn/channel/home/?SlJfApAfmEBp=1773108155625#/detail?id=12866975',
    source: '华能电子商务平台', publishDate: '2026-03-10',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '甘肃·华亭', sourceAuthority: '官方公开',
    amount: '86.8万元', amountNote: '中标结果公示确认86.8万元（与台账2026-03-06候选公示为同一项目）',
    confidence: '高',
    evidence: '华能电子商务平台2026-03-10中标结果公示：华能煤业华亭煤业陈家沟煤矿、砚北煤矿、煤炭智选公司智能干选机、破碎机、磁选机配件（限额以下）采购，中标人河北澳兰机械设备进出口有限公司，中标金额86.8万元。（与台账中标候选人公示2026-03-06为同一项目）',
    competitor: '河北澳兰机械设备进出口有限公司', winner: '河北澳兰机械设备进出口有限公司',
    buyer: '华能煤业华亭煤业（陈家沟/砚北/煤炭智选公司）', mineral: '煤', date: '2026-03-10'
  }
];

const exists = new Set(data.map(d => d.title));
let added = 0;
for (const n of news) {
  if (exists.has(n.title)) { console.log('跳过已存在:', n.title.slice(0, 30)); continue; }
  data.push({ ...n, procurement: n.amountNote || '', evidenceCapturedAt: now, id: mkId(n.url) });
  exists.add(n.title); added++;
}

writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`操作完成：新增 ${added} 条，删除 1 条，更正 1 条；平铺台账现有 ${data.length} 条`);
