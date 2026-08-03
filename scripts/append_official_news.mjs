// 追加"竞品公司官方渠道动态"（公众号/官网新闻/港交所公告/政府融媒/官方媒体报道）到平铺台账
// 2026-08-03 建立：首批 7 条官方自宣（置信度中）+ 2 条平台公示（置信度高）
// 用法: node scripts/append_official_news.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

const mkId = url => 'auto-' + Buffer.from(url).toString('base64').replace(/=+$/, '').slice(0, 22);

const now = new Date().toISOString();

// 字段口径（与抓取管道一致）：
// line 只用规范值：煤炭智能干选设备 / 矿石XRT光电分选设备
// confidence：官方自宣渠道标"中"；平台公示标"高"
const news = [
  {
    title: '唐山神州机械集团-蒙古国煤炭干法提质项目设备顺利发运',
    url: 'https://www.tsshenzhou.com/xinwen/20260723.html',
    source: '唐山神州机械集团官网新闻',
    publishDate: '2026-07-23',
    line: '煤炭智能干选设备',
    bid: '已交付',
    bidStatus: '已交付',
    region: '蒙古国（海外）',
    sourceAuthority: '官方自宣',
    amount: '未披露',
    amountNote: '官网新闻仅披露设备发运，未披露金额与业主名称',
    confidence: '中',
    evidence: '唐山神州机械集团官网"神州动态"2026-07-23发布《蒙古国煤炭干法提质项目设备顺利发运》，干法提质成套装备出厂发运，海外项目交付落地（金额、业主未披露）。',
    competitor: '唐山神州机械集团有限公司',
    buyer: '未披露',
    mineral: '煤',
    date: '2026-07-23'
  },
  {
    title: '南戈壁资源(01878.HK)与唐山神州机械订立蒙古敖包特陶勒盖煤矿干法选煤系统建设承包合同',
    url: 'https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0427/2026042703299_c.pdf',
    source: '港交所公告（南戈壁资源01878.HK）',
    publishDate: '2026-04-27',
    line: '煤炭智能干选设备',
    bid: '已签约',
    bidStatus: '已签约',
    region: '蒙古国（海外）',
    sourceAuthority: '官方自宣',
    amount: '约5380万元',
    amountNote: '港交所公告披露：总代价约人民币5380万元（约780万美元），含ZM600矿物高效分离机+IDS-2000智能干选机',
    confidence: '中',
    evidence: '南戈壁资源有限公司(01878.HK)2026-04-27公告：2026-04-22其蒙古全资附属公司Southgobi Sands LLC与唐山神州机械集团订立BT建设承包合同，由唐山神州在蒙古敖包特陶勒盖煤矿组建新干法选煤系统（ZM600矿物高效分离机+IDS-2000智能干选机），总代价约人民币5380万元（约780万美元），工期约3个月。',
    competitor: '唐山神州机械集团有限公司',
    buyer: '南戈壁资源（SGS，蒙古敖包特陶勒盖煤矿）',
    mineral: '煤',
    date: '2026-04-27'
  },
  {
    title: '霍里思特携手金徽新科打造国内矿山领域首条碳酸钙XRT光电智能分选生产线',
    url: 'http://www.honesort.com/news/company/34.html',
    source: '霍里思特官网新闻（官方媒体搜狐号同步）',
    publishDate: '2026-05-12',
    line: '矿石XRT光电分选设备',
    bid: '已投运',
    bidStatus: '已投运',
    region: '甘肃',
    sourceAuthority: '官方自宣',
    amount: '未披露',
    amountNote: '官方案例稿件未披露设备金额（设备为K108智能分选设备1台）',
    confidence: '中',
    evidence: '霍里思特官方媒体2026-05-12发布案例：金徽新科引进霍里思特K108智能分选设备（双能X射线透射检测），建成国内矿山领域首条碳酸钙XRT光电智能分选生产线。设备投产后精矿氧化钙纯度显著提升、二氧化硅含量稳定控制在2%以下。（设备于2024年12月引进投运，本篇为官方媒体案例回顾）',
    competitor: '霍里思特',
    buyer: '甘肃金徽新科材料有限公司',
    mineral: '石灰石',
    date: '2026-05-12'
  },
  {
    title: '霍里思特：国内首例金矿一分三光电分选应用（洛阳伊源）',
    url: 'http://www.honesort.com/news/company/531.html',
    source: '霍里思特官网新闻（官方媒体搜狐号同步）',
    publishDate: '2026-05-11',
    line: '矿石XRT光电分选设备',
    bid: '已投运',
    bidStatus: '已投运',
    region: '河南·洛阳',
    sourceAuthority: '官方自宣',
    amount: '未披露',
    amountNote: '官方案例稿件未披露设备金额',
    confidence: '中',
    evidence: '霍里思特官方媒体2026-05-11发布案例：洛阳伊源金矿为微细粒嵌布型难选金矿，矿石需分选为高品位金矿、优质骨料岩、安山岩三产品，霍里思特以X射线+色选可见光双融合技术建立国内首条金废石"一分三"智能光电分选线，光电分选机已在矿山现场稳定运行数月。',
    competitor: '霍里思特',
    buyer: '洛阳市伊源公路工程建筑有限公司',
    mineral: '金',
    date: '2026-05-11'
  },
  {
    title: '霍里思特携手南方路基破解砾石型硅石矿分选难题',
    url: 'https://www.honesort.com/news/company/528.html',
    source: '霍里思特官网新闻（官方媒体搜狐号同步）',
    publishDate: '2026-04-07',
    line: '矿石XRT光电分选设备',
    bid: '已投运',
    bidStatus: '已投运',
    region: '新疆',
    sourceAuthority: '官方自宣',
    amount: '未披露',
    amountNote: '官方案例稿件未披露设备金额',
    confidence: '中',
    evidence: '霍里思特官方媒体2026-04-07发布案例：双源协同（XRT+图像识别）为南方路基破解砾石型硅石矿分选难题。设备在新疆投产后，针对含废量不低于30%、粒度40-150mm原矿，精矿含杂率稳定控制在2%以内、废石中含精率低于1%，处理能力超180t/h，产量为原人工手选三倍以上。',
    competitor: '霍里思特',
    buyer: '南方路基（新疆项目，全称未披露）',
    mineral: '硅石',
    date: '2026-04-07'
  },
  {
    title: '好朋友科技2026年元月开门红获近亿元订单（中国矿业报报道）',
    url: 'https://thepaper.cn/newsDetail_forward_32877889',
    source: '澎湃号·中国矿业报（官方媒体报道）',
    publishDate: '2026-03-30',
    line: '矿石XRT光电分选设备',
    bid: '已签约',
    bidStatus: '已签约',
    region: '未披露',
    sourceAuthority: '官方自宣',
    amount: '近亿元',
    amountNote: '官方信息报道2026年元月获近亿元订单，未披露精确金额与客户名单',
    confidence: '中',
    evidence: '《中国矿业报》报道（澎湃号转载）：2026年元月，赣州好朋友科技迎来"开门红"，一举获得近亿元订单，覆盖多个有色金属低品位矿山；公司智能光电分选设备一秒可完成1万颗矿石精准分选。另据赣州经开区官网新闻佐证：2026年开局公司"爆单"，新订单预期比去年翻一倍。',
    competitor: '赣州好朋友科技股份有限公司',
    buyer: '未披露（多家有色矿山）',
    mineral: '未披露',
    date: '2026-03-30'
  },
  {
    title: '湖北金石智能装备开年拿下3台设备订单、Q1销售额同比增长30%',
    url: 'https://www.5210.cn/content/show?catid=332556&newsid=1213298',
    source: '夷陵融媒体（政府融媒）',
    publishDate: '2026-03-03',
    line: '矿石XRT光电分选设备',
    bid: '已签约',
    bidStatus: '已签约',
    region: '湖北·宜昌',
    sourceAuthority: '官方自宣',
    amount: '未披露',
    amountNote: '融媒报道未披露订单金额（开年3台设备订单，Q1销售额同比+30%，订单覆盖磷矿、银矿）',
    confidence: '中',
    evidence: '夷陵融媒体2026-03-03报道：湖北金石智能装备（宜昌"瞪羚"企业，湖北省内唯一专注矿石智能分选的人工智能科技企业）开年拿下3台设备订单，生产计划排至5月，第一季度销售额同比增长30%，订单覆盖磷矿、银矿等多个品类；同步推进兴山、四川、湖南等地4个项目设备安装调试；多光谱智能选矿设备依托可见光、XRT、UV与红外光谱多模块协同，磷矿分选效率达98%。',
    competitor: '湖北金石智能装备有限公司',
    buyer: '未披露（订单覆盖磷矿、银矿客户）',
    mineral: '磷、银',
    date: '2026-03-03'
  },
  {
    title: '同煤大唐塔山煤矿有限公司洗煤厂智能选矸设备维保服务中标结果公示',
    url: 'https://dzzb.jnkgjtdzzbgs.com/cms/default/webfile/2ywgg6/20260602/1246515677158703104.html',
    source: '晋能控股招标采购平台',
    publishDate: '2026-06-02',
    line: '煤炭智能干选设备',
    bid: '已中标',
    bidStatus: '已中标',
    region: '山西·大同',
    sourceAuthority: '官方公开',
    amount: '172.80万元',
    amountNote: '中标价格1728000.00元（维保服务，合同签订后一年）',
    confidence: '高',
    evidence: '同煤大唐塔山煤矿有限公司洗煤厂智能选矸设备维保服务中标结果公示（招标编号JNC302-ZB-260435978、SXMTZB2601F-354(G)）：中标人合肥泰禾卓海智能科技有限公司，中标价格1728000.00元；候选人阶段（2026-05-28公示）第二名天津矿嘉工程科技有限公司1783000元。',
    competitor: '合肥泰禾卓海智能科技有限公司',
    winner: '合肥泰禾卓海智能科技有限公司',
    buyer: '同煤大唐塔山煤矿有限公司',
    mineral: '煤',
    date: '2026-06-02'
  },
  {
    title: '山西省阳泉荫营煤业有限责任公司选煤厂加工管理平台项目001标段（手选大块矸石带煤在线自动检测装置）中标结果公示',
    url: 'https://dzzb.jnkgjtdzzbgs.com/cms/default/webfile/2ywgg6/20260309/1215661220393123840.html',
    source: '晋能控股招标采购平台',
    publishDate: '2026-03-09',
    line: '煤炭智能干选设备',
    bid: '已中标',
    bidStatus: '已中标',
    region: '山西·阳泉',
    sourceAuthority: '官方公开',
    amount: '162.86万元',
    amountNote: '中标价格1628600.00元（手选大块矸石带煤在线自动检测装置）',
    confidence: '高',
    evidence: '山西省阳泉荫营煤业有限责任公司选煤厂加工管理平台项目001标段（手选大块矸石带煤在线自动检测装置）二次招标中标结果公示（招标项目编号JNB336-ZB-251234129、SXMTZB2503H-184(G)）：中标人合肥泰禾卓海智能科技有限公司，中标价格1628600.00元；招标人山西省阳泉荫营煤业有限责任公司（太原煤炭气化集团下属）。',
    competitor: '合肥泰禾卓海智能科技有限公司',
    winner: '合肥泰禾卓海智能科技有限公司',
    buyer: '山西省阳泉荫营煤业有限责任公司',
    mineral: '煤',
    date: '2026-03-09'
  }
];

// 防重复：按 title 精确去重
const exists = new Set(data.map(d => d.title));
let added = 0;
for (const n of news) {
  if (exists.has(n.title)) { console.log('跳过已存在:', n.title.slice(0, 30)); continue; }
  data.push({
    ...n,
    procurement: n.amountNote || '',
    evidenceCapturedAt: now,
    id: mkId(n.url)
  });
  exists.add(n.title);
  added++;
}

writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`新增 ${added} 条，平铺台账现有 ${data.length} 条`);
