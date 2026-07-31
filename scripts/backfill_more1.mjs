// 第二批增量回填：公开可匿名查看渠道新发现的智能干选/XRT项目
// 原则：只加公开渠道(公共资源交易平台/省级招投标公共服务平台/政府公开页)公告；
//       金额/竞品逐条深挖；未披露必标原因；非煤XRT明确标注 line=矿石XRT光电分选(非煤)
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

const base = Date.now();
let n = 0;
const add = (r) => { r.id = `auto-more${n}-${base + n}`; data.push(r); n++; };

// 1) 华晋明珠煤业 配套选煤厂 招标计划（TDS工艺）
add({
  title: '山西华晋明珠煤业有限责任公司配套选煤厂招标计划公告',
  url: 'https://prec.sxzwfw.gov.cn/jyxxzbjh/1060526.jhtml',
  source: '山西省招标投标公共服务平台（公开）',
  sourceAuthority: '官方公开',
  bidStatus: '招标计划', bid: '招标计划',
  date: '2026-05-30', publishDate: '2026-05-30',
  region: '山西·临汾',
  line: '煤炭智能干选设备',
  competitor: '（招标计划，未定设备商）',
  winner: '',
  amount: '未披露',
  amountNote: '选煤厂招标计划(2026-05-30)：建设年入洗120万吨选煤厂，洗选工艺含TDS智能干选预排矸+脱泥无压三产品旋流器+TCS粗煤泥分选，项目总投资约1.63亿元，预计2026-06发布设备招标公告；本条为招标计划，尚无设备中标人/金额',
  confidence: '高',
  evidence: '山西华晋明珠煤业配套选煤厂招标计划：年入洗能力120万吨，工艺采用TDS智能干选预排矸，总投资16255万元，预计2026年06月发招标公告',
  bids: [],
});

// 2) 挖金湾虎龙沟 智能化干选系统 安装及配电工程 中标
add({
  title: '大同煤矿集团挖金湾虎龙沟煤业有限公司智能化干选系统项目(设备安装及配电工程)中标结果公示',
  url: 'https://dzzb.jnkgjtdzzbgs.com/cms/default/webfile/2ywgg6/20260608/1248591543976067072.html',
  source: '中国招标投标公共服务平台（晋能控股招标采购平台公开发布）',
  sourceAuthority: '公开',
  bidStatus: '已中标', bid: '已中标',
  date: '2026-06-08', publishDate: '2026-06-08',
  region: '山西·朔州',
  line: '煤炭智能干选(安装工程)',
  competitor: '晋能控股煤业集团宏远工程建设有限责任公司',
  winner: '晋能控股煤业集团宏远工程建设有限责任公司',
  amount: '402.0096万元',
  amountNote: '本条为智能化干选系统项目之设备安装及配电工程（招标编号JNA102-ZB-260515685），中标人宏远工程建设；干选设备采购中标人未在安装公告中披露，故竞品设备商未知',
  confidence: '高',
  evidence: '中标人：晋能控股煤业集团宏远工程建设有限责任公司，中标价格402.0096万元',
  bids: [{ rank: 1, company: '晋能控股煤业集团宏远工程建设有限责任公司', quote: '402.0096万元', quoteYuan: 4020096 }],
});

// 3) 淮北神源煤化工 智能干选机及配件 第一候选（奥博特186万）
add({
  title: '淮北矿业股份有限公司2026年神源煤化工智能干选机及配件公开招标中标候选人公示',
  url: 'https://www.youzhicai.com/nd/a57e2586-36d5-483a-b887-d6c0c563b15e-1.html',
  source: '安徽省招标投标信息网（公开）',
  sourceAuthority: '公开',
  bidStatus: '中标候选人', bid: '中标候选人',
  date: '2026-06-19', publishDate: '2026-06-19',
  region: '安徽·淮北',
  line: '煤炭智能干选设备',
  competitor: '合肥奥博特自动化设备有限公司',
  winner: '合肥奥博特自动化设备有限公司',
  amount: '186万元',
  amountNote: '中标候选人公示(2026-06-19)：第一候选合肥奥博特自动化设备186万元；截至2026-07-31未见中标公告，按候选阶段保守标注。招标范围含智能干选机1套+配件',
  confidence: '中',
  evidence: '第一中标候选人：合肥奥博特自动化设备有限公司，投标报价壹佰捌拾陆万元整(¥1860000元)，开标2026-06-18',
  bids: [{ rank: 1, company: '合肥奥博特自动化设备有限公司', quote: '186万元', quoteYuan: 1860000 }],
});

// 4) 中煤大同能源 动筛改光电射线智能干选 EPC（总包+干选机设备合并一条）
add({
  title: '中煤大同能源有限责任公司选煤厂动筛系统技术改造EPC总承包项目（含光电射线智能干选机）',
  url: 'https://www.zmzb.com/cms/channel/ywgg4gc/58486.htm',
  source: '中国招标投标公共服务平台（中煤招标采购网公开发布）',
  sourceAuthority: '公开',
  bidStatus: '已中标', bid: '已中标',
  date: '2026-05-27', publishDate: '2026-03-27',
  region: '山西·大同',
  line: '煤炭智能干选(EPC)',
  competitor: '天津美腾科技股份有限公司',
  winner: '中煤天津设计工程有限责任公司',
  amount: '1398.767183万元',
  amountNote: 'EPC总承包(中煤天津设计，CCTC20260186)中标1398.77万(公示2026-03-24~03-27)；本项目将动筛跳汰改造为光电射线智能干选系统，其中光电射线干选机设备分包由天津美腾中标(结果公告2026-05-27)，设备金额合同谈判后确定未披露',
  confidence: '高',
  evidence: 'EPC中标人：中煤天津设计工程有限责任公司，1398.767183万元；光电射线干选机分包成交人：天津美腾科技股份有限公司(2026-05-27)，智能干选机1套',
  bids: [
    { rank: 1, company: '中煤天津设计工程有限责任公司', quote: '1398.77万元', quoteYuan: 13987671 },
    { rank: 1, company: '天津美腾科技股份有限公司', quote: '未披露', note: '干选机设备分包' },
  ],
});

// 5) 淮南矿业 智能干选机升级改造（美腾中标，三家候选）
add({
  title: '淮南矿业（集团）有限责任公司物资采供中心智能干选机升级改造中标结果公告',
  url: 'https://www.ahtba.org.cn/site/trade/affiche/detail/c4067fed-63d6-11f1-b7f6-00163e1f3e9b',
  source: '安徽省招标投标信息网（公开）',
  sourceAuthority: '公开',
  bidStatus: '已中标', bid: '已中标',
  date: '2026-06-16', publishDate: '2026-06-16',
  region: '安徽·淮南',
  line: '煤炭智能干选设备',
  competitor: '天津美腾科技股份有限公司',
  winner: '天津美腾科技股份有限公司',
  amount: '未披露',
  amountNote: '中标候选人公示(2026-06-09)：第1天津美腾/第2合肥泰禾卓海/第3霍里思特；2026-06-16中标公告天津美腾中标，公告未披露金额',
  confidence: '高',
  evidence: '候选人：1天津美腾科技 2合肥泰禾卓海智能科技 3霍里思特科技(浙江)；2026-06-16中标公告天津美腾中标',
  bids: [
    { rank: 1, company: '天津美腾科技股份有限公司', quote: '未披露' },
    { rank: 2, company: '合肥泰禾卓海智能科技有限公司', quote: '未披露' },
    { rank: 3, company: '霍里思特科技（浙江）有限公司', quote: '未披露' },
  ],
});

// 6) 保康夏禹矿业 XRT选矿设备（非煤，湖北金石280万）
add({
  title: '保康夏禹矿业矿石精选项目XRT选矿设备采购中标结果公告',
  url: 'https://www.baokang.gov.cn/xxgk/zdxxgk/cgzb/zhongbgg/202604/t20260414_3986499.shtml',
  source: '保康县公共资源交易中心（公开）',
  sourceAuthority: '官方公开',
  bidStatus: '已中标', bid: '已中标',
  date: '2026-04-14', publishDate: '2026-04-14',
  region: '湖北·襄阳',
  line: '矿石XRT光电分选(非煤)',
  competitor: '湖北金石智能装备有限公司',
  winner: '湖北金石智能装备有限公司',
  amount: '280万元',
  amountNote: 'XRT选矿设备1套，湖北金石中标280万（综合评分92.43）；属非煤矿产（磷矿/萤石类）光电分选，计入光电分选竞品版图',
  confidence: '高',
  evidence: '供应商：湖北金石智能装备有限公司，中标金额280.00万元，综合评分法92.43分，采购选矿设备1套',
  bids: [{ rank: 1, company: '湖北金石智能装备有限公司', quote: '280万元', quoteYuan: 2800000 }],
});

// 7) 雷波小沟磷矿 光电分选机（非煤，泰禾卓海中标）
add({
  title: '雷波县小沟磷矿采选工程光电分选机(第二次)设备采购光电分选机标段中标结果公示',
  url: 'https://aiqicha.baidu.com/tenderbidding/detail?dataId=5b6678c47683426507007b7dfd44d5fe3825c729',
  source: '四川省公共资源交易（公开检索）',
  sourceAuthority: '公开',
  bidStatus: '已中标', bid: '已中标',
  date: '2026-04-24', publishDate: '2026-04-24',
  region: '四川·凉山',
  line: '矿石XRT光电分选(非煤)',
  competitor: '合肥泰禾卓海智能科技有限公司',
  winner: '合肥泰禾卓海智能科技有限公司',
  amount: '未披露',
  amountNote: '合肥泰禾卓海中标（2026-04-24，第二次招标），公告未披露具体金额；属磷矿光电分选（非煤），计入光电分选竞品版图',
  confidence: '中',
  evidence: '雷波县小沟磷矿采选工程光电分选机(第二次)设备采购光电分选机标段：四川发展天盛矿业有限公司，中标公司合肥泰禾卓海智能科技有限公司（2026-04-24）',
  bids: [{ rank: 1, company: '合肥泰禾卓海智能科技有限公司', quote: '未披露' }],
});

writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`新增 ${n} 条平铺记录，当前总数 ${data.length}`);
