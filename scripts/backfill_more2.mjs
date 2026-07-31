// 第三批增量抓取：新增 7 个项目 + 增强 4 个既有项目
// 原则：仅公开可匿名查看的公告来源；只取公告数据；逐条深挖竞品(供应商)与金额；
//      金额未披露必须写明真实原因；证据不足宁可降级，不做推测补全。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(__dirname, '..', 'src', 'data', 'intelligence.flat.json');
const data = JSON.parse(fs.readFileSync(FLAT, 'utf8'));

const stamp = () => 'more3-' + Math.random().toString(36).slice(2, 10);

// ---------------- 新增项目 ----------------
const ADD = [
  // 1. 中煤华晋 韩咀煤业 井下原位智能煤矸分选（首个井下智能干选总承包）—— 候选公示
  {
    title: '中煤华晋集团有限公司韩咀煤业井下原位智能煤矸分选与减排增效工艺研究与应用服务项目中标候选人公示',
    url: 'https://www.zmzb.com/cms/channel/ywgg4fw/60248.htm',
    source: '中煤招标有限责任公司官网（公开）· 候选人公示',
    sourceAuthority: '官方公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-06-26', publishDate: '2026-06-26',
    region: '山西', line: '井下原位智能干选（总承包）',
    buyer: '中煤华晋集团有限公司',
    competitor: '中煤天津设计工程有限责任公司',
    amount: '2696.61万元',
    amountNote: '候选人公示(2026-06-26)第一候选中煤天津设计报价2696.6116万元（含税），标段编号CCTC30260690',
    confidence: '高',
    evidence: '1 中煤天津设计工程有限责任公司 2696.6116（含税、万元）服务期18个月；2 中煤科工集团武汉设计研究院 2738.2717；3 中煤西安设计工程 3320.7573',
    specs: '井下成套搭建智能煤矸分选系统，配套巷道矸石充填处置体系，矸石就地原位消纳；服务期18个月',
    bids: [
      { rank: 1, company: '中煤天津设计工程有限责任公司', quote: '2696.6116万元', quoteYuan: 26966116, isWinner: true },
      { rank: 2, company: '中煤科工集团武汉设计研究院有限公司', quote: '2738.2717万元', quoteYuan: 27382717 },
      { rank: 3, company: '中煤西安设计工程有限责任公司', quote: '3320.7573万元', quoteYuan: 33207573 },
    ],
  },
  // 1b. 同项目中标公告
  {
    title: '中煤华晋集团有限公司韩咀煤业井下原位智能煤矸分选与减排增效工艺研究与应用服务项目中标结果公告',
    url: 'https://www.zmzb.com/cms/channel/ywgg5gc/',
    source: '中煤招标有限责任公司官网（公开）· 中标结果公告',
    sourceAuthority: '官方公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-07-13', publishDate: '2026-07-13',
    region: '山西', line: '井下原位智能干选（总承包）',
    buyer: '中煤华晋集团有限公司',
    competitor: '中煤天津设计工程有限责任公司',
    winner: '中煤天津设计工程有限责任公司',
    amount: '2696.61万元',
    amountNote: '中标公告(2026-07-13,项目编号CCTC30260690/01)仅列中标人未列金额；金额取自同项目中标候选人公示第一候选报价2696.6116万元',
    confidence: '高',
    evidence: '三、中标人：中煤天津设计工程有限责任公司（中煤招标有限责任公司）',
    scopeNote: '中煤天津设计公司公开称此为其中标的首个井下智能干选总承包项目',
    bids: [
      { rank: 1, company: '中煤天津设计工程有限责任公司', quote: '2696.6116万元', quoteYuan: 26966116, isWinner: true },
    ],
  },
  // 2. 陕西郭家河煤业 选煤厂智能干选 初步设计（代可研）—— 招标阶段，前置信号
  {
    title: '陕西郭家河煤业有限责任公司选煤厂智能干选项目初步设计(代可研)项目招标公告',
    url: 'http://www.china-zbycg.com/guest/info/4/732/279.html',
    source: '中国招标与采购网（公开）· 招标公告',
    sourceAuthority: '公开',
    bid: '招标公告', bidStatus: '招标公告',
    date: '2026-01-09', publishDate: '2026-01-09',
    region: '陕西·宝鸡', line: '智能干选（设计前置）',
    buyer: '陕西郭家河煤业有限责任公司',
    competitor: '未披露',
    amount: '未披露',
    amountNote: '设计类招标公告未公布招标控制价/预算，仅列投标保证金4000元；且截至2026-07-31未检索到公开的中标结果公告',
    confidence: '中',
    evidence: '项目概况：拆除原有2台手选皮带，更换为智能干选机；新建皮带栈桥1座及2座各500吨的矸石仓。项目地点：陕西省宝鸡市麟游县两亭镇郭家河煤矿；工期20日历天',
    specs: '拆除2台手选皮带改为智能干选机 + 新建皮带栈桥1座 + 2座500吨矸石仓；要求投标人具备选煤厂智能干选工程设计同类业绩',
    scopeNote: '本条为设计(代可研)前置标的，非设备采购；可作为后续干选机设备招标的先行信号',
  },
  // 3. 贵州天润 白布煤矿选煤厂 EPC 总承包（含智能干选机2台）
  {
    title: '贵州天润矿业有限公司白布煤矿选煤厂项目EPC总承包中标结果公告',
    url: 'https://ggzy.guizhou.gov.cn/tradeInfo/detailHtml?metaId=1171659649442992128',
    source: '贵州省公共资源交易云 / 毕节市公共资源交易中心（官方公开）',
    sourceAuthority: '官方公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-01-15', publishDate: '2026-01-15',
    region: '贵州·毕节', line: '选煤厂EPC总包（含智能干选机2台）',
    buyer: '贵州天润矿业有限公司白布煤矿',
    competitor: '中煤科工集团沈阳设计研究院有限公司',
    winner: '中煤科工集团沈阳设计研究院有限公司',
    amount: '15866.39万元',
    amountNote: '中标价158,663,864.97元（设计费320万+建安费9174.55万+设备购置费6043.83万+其它费用328万）；合同BBMK-GC-2026-003于2026-02-25签订，合同金额一致',
    confidence: '高',
    evidence: '中标人：中煤科工集团沈阳设计研究院有限公司，投标总报价158663864.97元；招标公告工艺设备清单明确含“智能干选机(二台)”',
    specs: '矿井型选煤厂，入选原煤1.50Mt/a，总投资估算19947.12万元；主要工艺设备含智能干选机(二台)、块煤破碎机、脱粉筛、原煤重介旋流器等；EPC交钥匙，工期360天',
    bids: [
      { rank: 1, company: '中煤科工集团沈阳设计研究院有限公司', quote: '15866.386497万元', quoteYuan: 158663864.97, isWinner: true },
      { rank: 2, company: '北京圆之翰工程技术有限公司', quote: '16206.00万元', quoteYuan: 162060000 },
      { rank: 3, company: '陕西普赛斯设计工程有限公司（联合体：山西中宇建设集团、山西宏厦建筑工程第三有限公司）', quote: '15598.80万元', quoteYuan: 155988000, note: '报价最低但综合评分列第三' },
    ],
  },
  // 4. 河南豫矿 塔吉克斯坦锡铜矿 智能光电选矿设备（海外）
  {
    title: '河南豫矿资源开发集团有限公司塔吉克斯坦穆吉斯通(Муджистон)锡铜矿智能光电选矿设备采购项目中标结果公告',
    url: 'https://www.ydkj.ha.cn/?gonggao/8941.html',
    source: '河南省豫地科技集团 / 河南招标采购综合网（公开）',
    sourceAuthority: '公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-04-28', publishDate: '2026-04-28',
    region: '河南（项目地：塔吉克斯坦）', line: '矿石智能光电分选（非煤·海外）',
    buyer: '河南豫矿资源开发集团有限公司',
    competitor: '赣州好朋友科技股份有限公司',
    winner: '赣州好朋友科技股份有限公司',
    amount: '240万元',
    amountNote: '第一候选赣州好朋友报价2,400,000元并于2026-04-28中标；注意第二候选美腾报价218.6万元更低，系综合评分定标',
    confidence: '高',
    evidence: '第一中标候选人：赣州好朋友科技股份有限公司 报价2400000.00元；第二：天津美腾科技 2186000.00元；第三：湖南鑫毅机电工程 2480000.00元。招标编号ZXYZB-2026-074，开标2026-04-23',
    specs: '锡铜矿智能光电选矿设备；交货期签订合同后10日历天',
    bids: [
      { rank: 1, company: '赣州好朋友科技股份有限公司', quote: '240.00万元', quoteYuan: 2400000, isWinner: true },
      { rank: 2, company: '天津美腾科技股份有限公司', quote: '218.60万元', quoteYuan: 2186000 },
      { rank: 3, company: '湖南鑫毅机电工程有限公司', quote: '248.00万元', quoteYuan: 2480000 },
    ],
  },
  // 5. 中煤建安69处 高头窑项目 分选机采购（内蒙古）
  {
    title: '中煤建筑安装工程集团有限公司第六十九工程处高头窑项目分选机采购结果公告',
    url: 'https://aiqicha.baidu.com/tenderbidding/detail?dataId=eb86704f36a4ccc4f108017416d543827e655756&pid=26798817538634',
    source: '爱企查（公开镜像）· 中煤集团电子商务平台询价成交',
    sourceAuthority: '公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-07-01', publishDate: '2026-07-01',
    region: '内蒙古·鄂尔多斯', line: '智能干选',
    buyer: '中煤建筑安装工程集团有限公司第六十九工程处',
    competitor: '天津美腾智能装备有限公司',
    winner: '天津美腾智能装备有限公司',
    amount: '未披露',
    amountNote: '中煤集团电子商务平台询价类成交公告惯例不公开成交金额（同类公告标注“成交金额：合同谈判后确定”）；询价通知2026-06-12发出，结果公告2026-07-01仅公示成交人',
    confidence: '中',
    evidence: '标题：六十九处高头窑项目分选机采购结果公告；工程号XJ20260603180；招标公司：中煤建筑安装工程集团有限公司第六十九工程处；中标公司：天津美腾智能装备有限公司',
    scopeNote: '询价采购（非公开招标），公告仅列成交人不列金额',
  },
  // 6. 四川省金河磷矿 磷矿破碎智能分筛扩建（非煤）
  {
    title: '四川省金河磷矿2025年20万吨/年磷矿破碎智能分筛扩建项目中标结果公告',
    url: 'https://www.msggzy.org.cn/front/cdmz/024001/024001003/20251230/cdmzfc11447f-115e-4f27-bffe-8ff75bdb23da.html',
    source: '成德眉资公共资源交易平台 / 德阳市公共资源交易中心（官方公开）',
    sourceAuthority: '官方公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2025-12-30', publishDate: '2025-12-30',
    region: '四川·德阳', line: '矿石光电智能分选（非煤·磷矿）',
    buyer: '四川省金河磷矿',
    competitor: '湖北金石智能装备有限公司',
    winner: '湖北金石智能装备有限公司',
    amount: '918.78万元',
    amountNote: '招标控制价1200万元，中标金额9,187,808元（较控制价下浮23.4%）；中标通知书2025-12-30发出',
    confidence: '高',
    evidence: '中标单位：湖北金石智能装备有限公司；招标控制价(元)12000000.00；中标金额(元)9187808.00；工期180日历天；开标2025-12-19',
    specs: '20万吨/年磷矿破碎智能分筛扩建；工期180日历天',
    bids: [
      { rank: 1, company: '湖北金石智能装备有限公司', quote: '918.7808万元', quoteYuan: 9187808, isWinner: true, note: '综合评标91.68分' },
      { rank: 2, company: '湖南升华智选装备制造有限公司', quote: '980.00万元', quoteYuan: 9800000, note: '88.99分' },
      { rank: 3, company: '同方威视技术股份有限公司', quote: '866.00万元', quoteYuan: 8660000, note: '报价最低但综合评分87.84分列第三' },
    ],
  },
  // 7. 佳鑫(珠海横琴) 哈萨克斯坦巴库塔钨矿 光电智能分选机 10台套（海外大单）
  {
    title: '佳鑫(珠海横琴)技术服务有限公司哈萨克斯坦巴库塔钨矿光电智能分选机采购项目中标候选人排序公示',
    url: 'https://www.jczh.com/notice/385546',
    source: '精彩纵横云采购平台 / 江铜集团电子招投标采购平台（公开）',
    sourceAuthority: '公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-07-23', publishDate: '2026-07-23',
    region: '广东·珠海（项目地：哈萨克斯坦）', line: '矿石光电智能分选（非煤·海外）',
    buyer: '佳鑫(珠海横琴)技术服务有限公司（佳鑫国际资源03858.HK子公司）',
    competitor: '赣州好朋友科技股份有限公司',
    amount: '未披露',
    amountNote: '候选人排序公示仅公开排序未公开投标报价；招标公告(2026-07-02)亦未设公开招标控制价，仅列投标保证金20万元；截至2026-07-31未见中标结果公告',
    confidence: '中',
    evidence: '招标范围：光电智能分选机6台套(10-40mm,≥110t/h/台套) + 4台套(40-80mm,≥95t/h/台套)，共10台套；交货地点新疆霍尔果斯口岸附近仓库；开标2026-07-22；候选人排序公示2026-07-23第一名赣州好朋友科技股份有限公司',
    specs: '共10台套：6台套处理粒级10-40mm、处理量≥110t/h；4台套处理粒级40-80mm、处理量≥95t/h。业绩门槛：含WO3原矿品位≥0.175%时抛废率≥60%、抛出废石WO3≤0.03%',
    bids: [
      { rank: 1, company: '赣州好朋友科技股份有限公司', quote: '未披露', note: '平台仅公示排序，未公示报价' },
    ],
  },
];

// ---------------- 既有项目的新阶段（用于时间线与状态升级） ----------------
const ENRICH = [
  // 冀中12标包 → 中标公告
  {
    title: '冀中能源股份有限公司2026年度设备采购第四批12标包（智能干选系统）中标公告',
    url: 'https://www.12369zb.com/view/11864/OBwlNZ8Bni4p5U9Xh9TY.html',
    source: '河北省招标投标公共服务平台（公开镜像）· 中标公告',
    sourceAuthority: '公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-07-06', publishDate: '2026-07-06',
    region: '河北·邢台', line: '智能干选',
    buyer: '冀中能源股份有限公司',
    competitor: '唐山神州机械集团有限公司',
    winner: '唐山神州机械集团有限公司',
    amount: '318.00万元',
    amountNote: '中标公告(2026-07-06)中标价3,179,999.67元，与候选公示第一候选报价一致；交货期合同签订起30天内',
    confidence: '高',
    evidence: '12标包：智能干选系统 中标人唐山神州机械集团有限公司 中标价格3179999.67元 交货期自合同签订起30天内',
    bids: [
      { rank: 1, company: '唐山神州机械集团有限公司', quote: '317.999967万元', quoteYuan: 3179999.67, isWinner: true, note: '评分85.24' },
      { rank: 2, company: '枣庄海纳科技有限公司', quote: '349.950039万元', quoteYuan: 3499500.39, note: '评分83.18' },
      { rank: 3, company: '霍里思特科技(浙江)有限公司', quote: '419.682万元', quoteYuan: 4196820, note: '评分80.73' },
    ],
  },
  // 淮北神源 → 中标公告（状态升级）
  {
    title: '淮北矿业股份有限公司2026年神源煤化工智能干选机及配件公开招标中标公告',
    url: 'https://www.youzhicai.com/nd/3627824f-7f4d-41bd-aa51-5c04e94dfe95-1.html',
    source: '安徽省招标投标信息网（公开）· 中标公告',
    sourceAuthority: '公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-07-10', publishDate: '2026-07-10',
    region: '安徽·淮北', line: '煤炭智能干选设备',
    buyer: '淮北矿业股份有限公司',
    competitor: '合肥奥博特自动化设备有限公司',
    winner: '合肥奥博特自动化设备有限公司',
    amount: '186万元',
    amountNote: '中标公告(2026-07-10)中标金额壹佰捌拾陆万元整(¥1,860,000)，与候选公示报价一致；招标编号HBKY-2026-H-0163',
    confidence: '高',
    evidence: '中标单位：合肥奥博特自动化设备有限公司；中标金额：壹佰捌拾陆万元整(¥1860000.0000元)；淮北矿业招标管理中心 2026年7月10日',
    bids: [
      { rank: 1, company: '合肥奥博特自动化设备有限公司', quote: '186万元', quoteYuan: 1860000, isWinner: true },
    ],
  },
  // 雷波小沟 → 评标结果公示（补齐三家报价与金额）
  {
    title: '雷波县小沟磷矿采选工程光电分选机(第二次)设备采购光电分选机标段评标结果公示',
    url: 'https://ggzyjy.sc.gov.cn/jyxx/002001/002001006/20260424/818f5d4a-895c-406e-8dfa-7ef741396ed7.html',
    source: '全国公共资源交易平台（四川省）· 评标结果公示（官方公开）',
    sourceAuthority: '官方公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-04-24', publishDate: '2026-04-24',
    region: '四川·凉山', line: '矿石光电分选（非煤·磷矿）',
    buyer: '四川发展天盛矿业有限公司',
    competitor: '合肥泰禾卓海智能科技有限公司',
    amount: '2468.60万元',
    amountNote: '评标结果公示投标最高限价2900万元；合肥泰禾卓海报价24,686,000元综合评分59.57列前，最终中标；三家候选报价差距仅2.2%',
    confidence: '高',
    evidence: '投标最高限价(元)29000000.00；合肥泰禾卓海智能科技 24686000.00；天津美腾科技 24793000.00；霍里思特科技(浙江) 25230000.00；开标2026-04-22',
    specs: '磷矿采选工程光电分选机（第二次招标）；交货期合同签订之日起60天内',
    bids: [
      { rank: 1, company: '合肥泰禾卓海智能科技有限公司', quote: '2468.60万元', quoteYuan: 24686000, isWinner: true },
      { rank: 2, company: '天津美腾科技股份有限公司', quote: '2479.30万元', quoteYuan: 24793000 },
      { rank: 3, company: '霍里思特科技(浙江)有限公司', quote: '2523.00万元', quoteYuan: 25230000 },
    ],
  },
];

// ---------------- 写入 ----------------
const before = data.length;
for (const r of [...ADD, ...ENRICH]) {
  const dup = data.find(x => x.title === r.title);
  if (dup) { console.log('  跳过(标题已存在)：' + r.title.slice(0, 40)); continue; }
  data.push({ ...r, id: 'auto-' + stamp() });
}

// 中煤大同：补充同一 EPC 下的配套分包（矸石限下筛），丰富竞品链条
const dt = data.find(x => (x.title || '').includes('中煤大同能源') && (x.title || '').includes('EPC'));
if (dt && Array.isArray(dt.bids) && !dt.bids.some(b => /赛普瑞特/.test(b.company))) {
  dt.bids.push({
    rank: dt.bids.length + 1,
    company: '赛普瑞特(天津)工业技术有限公司',
    quote: '未披露',
    note: '矸石限下筛配套分包（询价编码XJ20260503202，2026-07-10成交，成交金额合同谈判后确定）',
  });
  console.log('  已为中煤大同EPC补充配套分包供应商：赛普瑞特(天津)');
}

fs.writeFileSync(FLAT, JSON.stringify(data, null, 2), 'utf8');
console.log(`\nflat 记录：${before} → ${data.length}（新增 ${data.length - before} 条）`);
