// 索引回溯轮落库（2026-08-03）：聚合站摘要发现线索→官方/多源交叉核验→追加
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));
const mkId = u => 'auto-' + Buffer.from(u).toString('base64').replace(/=+$/, '').slice(0, 22);
const now = new Date().toISOString();

const news = [
  {
    title: '民丰县某矿山分选站固定资产采购项目成交结果公示',
    url: 'https://www.xjygcg.com/jyxx/001002/001002003/20260715/2524171937723238400.html',
    source: '新疆阳光采购平台', publishDate: '2026-07-15',
    line: '矿石XRT光电分选设备', bid: '已中标', bidStatus: '已中标',
    region: '新疆·和田（民丰）', sourceAuthority: '官方公开',
    amount: '351.8万元', amountNote: '成交价格3518000.00元（分选站固定资产：分选机/空压机/给料器等）',
    confidence: '高',
    evidence: '新疆阳光采购平台2026-07-15成交结果公示（项目编号XKGYL-XB2026-219）：民丰县某矿山分选站固定资产采购项目，成交人霍里思特科技(浙江)有限公司，成交价格3518000.00元，采购人新疆地质工程有限公司，公告发布于新矿集团供应链平台与新疆阳光采购平台。公告未披露矿种（民丰县已知有硝尔库勒锑矿项目）。',
    competitor: '霍里思特', winner: '霍里思特',
    buyer: '新疆地质工程有限公司', mineral: '未披露', date: '2026-07-15'
  },
  {
    title: '雁宝能源内蒙古蒙东能源有限公司首选系统智能干选设备采购项目公开招标中标结果公告',
    url: 'https://www.chnenergybidding.com.cn/bidweb/001/001006/001006001/20260408/2e3babce-522c-4ee7-a0e2-bf2dd9191366.html',
    source: '国家能源招标网（国能e招）', publishDate: '2026-04-08',
    line: '煤炭智能干选设备', bid: '已中标', bidStatus: '已中标',
    region: '内蒙古·呼伦贝尔', sourceAuthority: '官方公开',
    amount: '1067.58万元', amountNote: '中标结果公告（招标编号CEZB260301572001；与台账2026-04-03候选公示为同一项目）',
    confidence: '高',
    evidence: '国能e招2026-04-08中标结果公告：雁宝能源内蒙古蒙东能源有限公司选煤系统智能干选设备采购项目公开招标，中标人唐山神州机械集团有限公司（包号CEZB260301572001）；候选阶段（2026-04-03公示）第一神州1067.58万、第二威海海王1100.0028万。',
    competitor: '唐山神州机械集团有限公司', winner: '唐山神州机械集团有限公司',
    buyer: '内蒙古蒙东能源有限公司', mineral: '煤', date: '2026-04-08'
  },
  {
    title: '中钨高新2025年11月远景钨业分选机询价书MJJ032采购结果公示',
    url: 'https://www.jianyu360.cn/nologin/content/SEEY1xrcS4vKDk6AmdxcFwoCycCFjJ0V3h0KB4nIy9Fd3lwAyNUCXI.html',
    source: '中钨高新供应链平台（剑鱼/千里马/知了标讯交叉核验）', publishDate: '2026-01-05',
    line: '矿石XRT光电分选设备', bid: '已中标', bidStatus: '已中标',
    region: '湖南·衡阳（衡南）', sourceAuthority: '公开',
    amount: '350万元', amountNote: '成交总额3500000.00元（分选机整机；公示期2026-01-05至01-07）',
    confidence: '中',
    evidence: '中钨高新2025年11月远景钨业分选机询价书MJJ032采购结果公示（2026-01-05）：成交金额3500000.00元，中标公司赣州好朋友科技有限公司，采购单位衡阳远景钨业有限责任公司（中钨高新材料成员企业，湖南衡阳衡南县）。原文在五矿供应链平台需登录，经千里马/剑鱼/知了标讯多源交叉核验。',
    competitor: '赣州好朋友科技股份有限公司', winner: '赣州好朋友科技股份有限公司',
    buyer: '衡阳远景钨业有限责任公司（中钨高新成员企业）', mineral: '钨', date: '2026-01-05'
  },
  {
    title: '黑龙江龙煤双鸭山矿业有限责任公司第四次需用设备采购-第二次招标中标候选人公示',
    url: 'https://www.qcc.com/crun/4de95399a1eadd16f478ef4dfde5cb41.html',
    source: '龙煤双鸭山矿业招标（企查查/水滴信用/爱企查交叉核验）', publishDate: '2026-07-03',
    line: '煤炭智能干选设备', bid: '中标候选人', bidStatus: '中标候选人',
    region: '黑龙江·双鸭山', sourceAuthority: '公开',
    amount: '2012.61万元（候选）', amountNote: '候选报价20126084.00元；候选阶段待定标结果',
    confidence: '中',
    evidence: '黑龙江龙煤双鸭山矿业有限责任公司第四次需用设备采购-第二次招标中标候选人公示（2026-07-03）：合肥泰禾卓海智能科技有限公司为中标候选人，中标金额20126084元（企查查动态/水滴信用/爱企查多源交叉核验，原文在龙煤矿业招标平台需登录）。',
    competitor: '合肥泰禾卓海智能科技有限公司',
    buyer: '黑龙江龙煤双鸭山矿业有限责任公司', mineral: '煤', date: '2026-07-03'
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
console.log('索引回溯追加', n, '条，平铺台账现有', data.length, '条');
