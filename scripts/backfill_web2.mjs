// 第二轮回填：结果类公告金额 + 新发现阶段/项目补录
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(__dirname, '../src/data/intelligence.flat.json');
const data = JSON.parse(fs.readFileSync(FLAT, 'utf8'));
console.log('回填前条数:', data.length);

let patched = 0;
const patchAll = (match, fields, label) => {
  const rs = data.filter(match);
  if (!rs.length) { console.log('!! 未找到:', label); return; }
  rs.forEach(r => Object.assign(r, fields));
  patched += rs.length;
  console.log('已回填:', label, 'x' + rs.length, '->', fields.amount || '(仅备注)');
};

// 1) 神东保德EPC 中标候选人公示（2条重复记录一并回填）
patchAll(
  r => (r.title || '').includes('保德选煤厂') && (r.title || '').includes('中标候选人'),
  {
    amount: '2046.74万元',
    competitor: '中煤科工集团沈阳设计研究院有限公司（第一候选人）',
    winner: '中煤科工集团沈阳设计研究院有限公司',
    amountNote: '第2次中标候选人公示：第一候选人中煤科工沈阳设计院报价2046.7417万元（第二候选人煤炭工业石家庄设计院2109.28万元）。系EPC总承包价。原文见chnenergybidding.com.cn，经Web交叉检索确认。后续设备分包：智能干选机（二次）由霍里思特以754万元中标（2026-03-09）。',
  },
  '保德EPC候选人公示'
);

// 2) 西安科大并联机器人 中标结果（原空壳页）
patchAll(
  r => (r.title || '').includes('西安科技大学') && (r.title || '').includes('并联机器人'),
  {
    amount: '36万元',
    competitor: '山东伯特利工业科技有限公司',
    winner: '山东伯特利工业科技有限公司',
    amountNote: '原页面为空壳；经陕西政府采购网原始公告确认：成交金额36万元（预算49万元），标的Birtley BTL-BR-34智能选矸并联机器人1套。',
  },
  '西安科大机器人'
);

// 3) 郭家台二号 TDS干选机 中标结果（原空壳页）
patchAll(
  r => (r.title || '').includes('郭家台') && (r.title || '').includes('中标结果'),
  {
    amount: '350万元',
    competitor: '天津美腾科技股份有限公司',
    winner: '天津美腾科技股份有限公司',
    amountNote: '原页面为空壳；经多家公开渠道（新浪财经/企查查转载）确认：2026-05-18公告美腾中标350万元。入围方还含山东先卓、霍里思特。',
  },
  '郭家台结果公告'
);
patchAll(
  r => (r.title || '').includes('郭家台') && (r.title || '').includes('招标公告'),
  { amountNote: '招标公告无预算；同项目中标结果已披露美腾350万元，见项目时间线。' },
  '郭家台招标公告备注'
);

// 4) 华亭山寨 末煤干选设备租赁（原PDF壳）
patchAll(
  r => (r.title || '').includes('山寨煤矿') && (r.title || '').includes('干选设备租赁'),
  {
    amount: '2836.93万元',
    competitor: '唐山神州机械集团有限公司',
    winner: '唐山神州机械集团有限公司',
    amountNote: '原公告正文为PDF附件；经启信宝/剑鱼标讯等公开渠道确认：2026-06-16中标结果公示，唐山神州2836.929万元（框架3年，计划入选275.43万吨，候选方还有锡林郭勒盟神工制造）。',
  },
  '华亭山寨租赁'
);

// 5) 泊里煤矿 智能干选机（原招标公告无金额 → 补中标结果）
patchAll(
  r => (r.title || '').includes('泊里煤矿') && (r.title || '').includes('招标公告'),
  { amountNote: '招标公告无预算；同项目2026-06-12中标结果公示：威海海王630万元，见项目时间线。' },
  '泊里招标公告备注'
);

// 6) 新增记录：Web交叉检索发现的后续阶段与新项目
const NEW_RECORDS = [
  {
    id: 'web-poli-result',
    title: '山西阳泉矿区泊里煤矿项目井下智能分选系统智能干选机中标结果公示',
    line: '煤炭智能干选设备',
    competitor: '威海市海王科技有限公司',
    winner: '威海市海王科技有限公司',
    region: '山西省',
    amount: '630万元',
    bid: '已中标', bidStatus: '已中标',
    source: '中国机电设备招标（转自山西省招投标平台，Web交叉检索）',
    sourceAuthority: 'cross-search',
    date: '2026-06-12', publishDate: '2026-06-12',
    confidence: '高',
    url: 'https://www.chinamae.com/partner/e6e219ce86f3978ddb254361e9a474c2.html',
    evidence: '招标编号JSH2026-421，第一标段中标人威海市海王科技有限公司，中标价630.000000万元。入围供应商：枣庄海纳、霍里思特、威海海王。',
    amountNote: 'ggzy仅有招标公告，结果经跨平台交叉检索取得。',
  },
  {
    id: 'web-baode-device',
    title: '【沈阳设计院】保德选煤厂智能干选改造(EPC)智能干选机采购(二次)中标公告',
    line: '煤炭智能干选设备',
    competitor: '霍里思特科技（浙江）有限公司',
    winner: '霍里思特科技（浙江）有限公司',
    region: '山西省',
    amount: '754万元',
    bid: '已中标', bidStatus: '已中标',
    source: '中国煤科电子采购平台（Web交叉检索）',
    sourceAuthority: 'cross-search',
    date: '2026-03-09', publishDate: '2026-03-09',
    confidence: '高',
    url: 'https://cg.ccteg.cn/cms/channel/ywgg4hw/72286.htm',
    evidence: '招标编号LNCX2025021-WZ，中标人霍里思特科技（浙江）有限公司，中标价格7,540,000.00元。系保德EPC项目下的智能干选机设备分包。',
    amountNote: '保德EPC（沈阳院2046.74万总承包）项下设备分包，经跨平台交叉检索取得。',
  },
  {
    id: 'web-jizhong-12',
    title: '冀中能源股份有限公司2026年度设备采购第四批12标包（智能干选系统）中标候选人公示',
    line: '煤炭智能干选设备',
    competitor: '唐山神州机械集团有限公司（第一候选人）',
    region: '河北省',
    amount: '318万元',
    bid: '中标候选人', bidStatus: '中标候选人',
    source: '河北省招标投标公共服务平台（Web交叉检索）',
    sourceAuthority: 'official',
    date: '2026-07-01', publishDate: '2026-07-01',
    confidence: '高',
    url: 'https://szj.hebei.gov.cn/zbtbfwpt/infogk/detail.do?bdcodes=D1305000277112209001001&categoryid=101103&infoid=D1305000277112209001001001',
    evidence: '12标包智能干选系统：第一候选人唐山神州3179999.67元；第二枣庄海纳3499500.39元；第三霍里思特4196820元。河北玖河因防爆证无效被否决。开标2026-06-30。',
    amountNote: '深挖新增：三家竞价完整（神州318.0万/海纳349.95万/霍里思特419.68万）。',
  },
  {
    id: 'web-lana-result',
    title: '甘肃兰阿煤业有限责任公司干法选煤设备采购项目成交公示',
    line: '煤炭智能干选设备',
    competitor: '唐山神州机械集团有限公司',
    winner: '唐山神州机械集团有限公司',
    region: '甘肃省',
    amount: '258万元',
    bid: '已成交', bidStatus: '已中标',
    source: '启信宝标讯（Web交叉检索）',
    sourceAuthority: 'cross-search',
    date: '2026-07-01', publishDate: '2026-07-01',
    confidence: '中',
    url: 'https://wx.qixin007.com/bidding/dc8a0cda-2e1a-4b23-a473-a2266227f60e',
    evidence: '2026-07-01发布，甘肃兰阿煤业干法选煤设备采购项目成交公示，成交方唐山神州机械集团有限公司，成交金额258万元。',
    amountNote: '深挖新增：源自企业标讯聚合快照，建议以原平台复核。',
  },
];

const urls = new Set(data.map(r => r.url));
let added = 0;
for (const rec of NEW_RECORDS) {
  if (urls.has(rec.url)) { console.log('跳过已存在:', rec.title.slice(0, 30)); continue; }
  rec.evidenceCapturedAt = new Date().toISOString();
  data.push(rec); added++;
  console.log('新增:', rec.title.slice(0, 40), '->', rec.amount);
}

console.log('回填条数:', patched, '| 新增条数:', added, '| 总条数:', data.length);
fs.writeFileSync(FLAT, JSON.stringify(data, null, 2), 'utf8');
console.log('已写入');
