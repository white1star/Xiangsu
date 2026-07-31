// 第四批增量抓取：新增 9 个项目（2026-07-31 续扒）
// 原则：仅公开可匿名查看的公告来源；只取公告数据；逐条深挖竞品(供应商)与金额；
//      金额未披露必须写明真实原因；证据不足宁可降级，不做推测补全。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(__dirname, '..', 'src', 'data', 'intelligence.flat.json');
const data = JSON.parse(fs.readFileSync(FLAT, 'utf8'));

const stamp = () => 'more4-' + Math.random().toString(36).slice(2, 10);

// ---------------- 新增项目 ----------------
const ADD = [
  // 1. 内蒙古智能煤炭 麻地梁煤矿 TDS智能干选机技术维保服务(二次) —— 候选人公示
  {
    title: '内蒙古智能煤炭有限责任公司麻地梁煤矿采购干选车间 TDS 智能干选机技术维保服务(二次招标)中标候选人公示',
    url: 'http://nmgxh.86ztb.com/downFile.htm?ids=OTcxMTUzODgtYzc5OS00YzUyLWE0ODQtNTBiNzFjNDczZDMy',
    source: '内蒙古自治区招标投标公共服务平台（公开镜像）· 中标候选人公示',
    sourceAuthority: '公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-01-08', publishDate: '2026-01-08',
    region: '内蒙古·鄂尔多斯', line: 'TDS智能干选机技术维保',
    buyer: '内蒙古智能煤炭有限责任公司',
    competitor: '内蒙古义恒工业技术有限公司',
    amount: '未披露',
    amountNote: '仅公示中标候选人，未披露最终中标价；第一候选内蒙古义恒工业技术报价315万元、第二山东博海机械318.96万元、第三北京云鸿泰312万元，三家报价接近',
    confidence: '中',
    evidence: '2026-01-08 中标候选人公示：包1 内蒙古义恒工业技术有限公司 3150000.00元（推荐第一）；山东博海机械设备有限公司 3189600.00元（第二）；北京云鸿泰科技有限公司 3120000.00元（第三）；服务期一年，地点麻地梁煤矿（准格尔旗龙口镇）',
    bids: [
      { rank: 1, company: '内蒙古义恒工业技术有限公司', quote: '315.00万元', quoteYuan: 3150000, note: '推荐第一中标候选人' },
      { rank: 2, company: '山东博海机械设备有限公司', quote: '318.96万元', quoteYuan: 3189600 },
      { rank: 3, company: '北京云鸿泰科技有限公司', quote: '312.00万元', quoteYuan: 3120000 },
    ],
  },
  // 2. 中振建设 智能选矸系统设备采购 —— 招标公告（晋能平台公开发布）
  {
    title: '中振建设有限公司智能选矸系统设备采购招标公告',
    url: 'https://dzzb.jnkgjtdzzbgs.com/cms/default/webfile/2ywgg1/20260402/1224312836772069376.html',
    source: '中国招标投标公共服务平台（晋能控股招标采购平台公开发布）· 招标公告',
    sourceAuthority: '公开',
    bid: '招标公告', bidStatus: '招标公告',
    date: '2026-04-02', publishDate: '2026-04-02',
    region: '山西·太原', line: '智能选矸系统（设备采购）',
    buyer: '中振建设有限公司',
    competitor: '尚未定标（招标公告）',
    amount: '未披露',
    amountNote: '招标公告未披露预算/招标控制价；开标时间2026-04-15 09:00，截至2026-07-31未检索到中标结果公告',
    confidence: '中',
    evidence: '招标编号JNB149-ZB-260315295；项目地点山西转型综合改革示范区学府产业园高新街17号；交货期合同签订后一个月；投标人须具智能干选机生产能力（制造商或授权代理商）',
    bidOpenDate: '2026-04-15', openStatus: '已开标',
    scopeNote: '招标公告阶段，确认设备采购需求（智能干选机），中标人待定',
  },
  // 3. 内蒙古双欣矿业 选煤厂原煤线块矸石智能排矸系统升级优化服务 —— 招标公告
  {
    title: '内蒙古双欣矿业有限公司选煤厂原煤线块矸石智能排矸系统升级优化服务招标项目招标公告',
    url: 'http://www.dlzb.org/news/202606/09/563173.html',
    source: '中国招标投标公共服务平台（公开镜像）· 招标公告',
    sourceAuthority: '公开',
    bid: '招标公告', bidStatus: '招标公告',
    date: '2026-06-08', publishDate: '2026-06-08',
    region: '内蒙古·鄂尔多斯', line: '智能排矸机器人升级优化服务',
    buyer: '内蒙古双欣矿业有限公司',
    competitor: '尚未定标（招标公告）',
    amount: '未披露',
    amountNote: '招标公告未披露预算/控制价；服务期限设备改造合同签订后60天内完成；截至2026-07-31未检索到中标结果公告',
    confidence: '中',
    evidence: '项目编号SNZB-XBKY-D1000011119；对现有智能选矸机器人出具设计方案并优化升级，完善选矸机器人抓手3套，降低矸石拣选下限至100mm，大块煤破碎机升级；资质要求建筑机电安装工程专业承包二级及以上',
    bidOpenDate: '未披露', openStatus: '未披露',
    scopeNote: '本条为智能排矸机器人系统升级优化服务（非整机采购），属智能分选应用延伸',
  },
  // 4. 神东煤炭 筛分系统机器人（智能煤矸分选机器人）集中招标 —— 招标公告
  {
    title: '神东煤炭2026年4月13批筛分系统机器人集中公开招标项目招标公告',
    url: 'https://www.chnenergybidding.com.cn/bidweb/001/001002/001002001/20260522/4a6255cc-c645-4d29-9c9b-6feb29e9e8c6.html',
    source: '国能e招（国家能源集团电子商务平台）公开公告· 招标公告',
    sourceAuthority: '公开',
    bid: '招标公告', bidStatus: '招标公告',
    date: '2026-05-22', publishDate: '2026-05-22',
    region: '内蒙古·鄂尔多斯', line: '智能煤矸分选机器人',
    buyer: '中国神华能源股份有限公司神东煤炭分公司',
    competitor: '尚未定标（招标公告）',
    amount: '未披露',
    amountNote: '招标公告未披露预算/控制价；交货期合同签订后120天内到货；截至2026-07-31未检索到中标结果公告',
    confidence: '中',
    evidence: '招标编号CEZB260303907；物料：智能煤矸分选机器人\\GPRT\\150t/h\\国产 1台（洗选中心，矸石识别率≥95%）；另有拣杂机器人1套；资格要求投标人须为煤矸分选机器人或煤矸分选系统生产厂家，单份合同金额≥100万元',
    bidOpenDate: '未披露', openStatus: '未披露',
    scopeNote: '智能煤矸分选机器人（机器视觉/XRT路线）招标，属智能分选装备范畴',
  },
  // 5. 新疆天顺矿业 2026年设备购置(第四批) 智能干选机 —— 成交候选人公示（谈判采购）
  {
    title: '新疆天顺矿业有限公司2026年设备购置(第四批)成交候选人公示',
    url: 'https://www.jzbidding.com/cms/jzny/webfile/zd20=jsgczbhxr/20260626/1255243177271492608.html',
    source: '河北省招标投标公共服务平台（公开镜像）· 成交候选人公示',
    sourceAuthority: '公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-06-26', publishDate: '2026-06-26',
    region: '新疆·哈密', line: '智能干选机（设备购置）',
    buyer: '新疆天顺矿业有限公司',
    competitor: '威海市海王科技有限公司',
    amount: '未披露',
    amountNote: '成交候选人公示（谈判采购），第一候选威海市海王科技报价425.000006万元，尚未见成交结果公告；同标包含布料器、滚轴分级筛、智能干选机',
    confidence: '中',
    evidence: '开标2026-06-24；1标包 布料器、滚轴分级筛、智能干选机：威海市海王科技有限公司 4250000.06元（第一）；霍里思特科技(浙江)有限公司 4508700元（第二）；交货期合同签订后30天内',
    bids: [
      { rank: 1, company: '威海市海王科技有限公司', quote: '425.00万元', quoteYuan: 4250000.06, note: '推荐第一成交候选人' },
      { rank: 2, company: '霍里思特科技(浙江)有限公司', quote: '450.87万元', quoteYuan: 4508700 },
    ],
  },
  // 6. 同煤大唐塔山煤矿 洗煤厂智能选矸设备维保服务 —— 中标结果公示
  {
    title: '同煤大唐塔山煤矿有限公司洗煤厂智能选矸设备维保服务中标结果公示',
    url: 'https://dzzb.jnkgjtdzzbgs.com/cms/default/webfile/2ywgg6/20260602/1246515677158703104.html?cid=14',
    source: '中国招标投标公共服务平台（晋能控股招标采购平台公开发布）· 中标结果公示',
    sourceAuthority: '公开',
    bid: '已中标', bidStatus: '已中标',
    date: '2026-06-02', publishDate: '2026-06-02',
    region: '山西·大同', line: '智能选矸设备维保',
    buyer: '同煤大唐塔山煤矿有限公司',
    competitor: '合肥泰禾卓海智能科技有限公司',
    winner: '合肥泰禾卓海智能科技有限公司',
    amount: '172.80万元',
    amountNote: '中标结果公示(2026-06-02)中标金额1,728,000.00元；候选公示2026-05-28',
    confidence: '高',
    evidence: '同煤大唐塔山煤矿有限公司洗煤厂智能选矸设备维保服务中标结果公示（2026-06-02）；中标人合肥泰禾卓海智能科技有限公司',
    bids: [
      { rank: 1, company: '合肥泰禾卓海智能科技有限公司', quote: '172.80万元', quoteYuan: 1728000, isWinner: true },
    ],
  },
  // 7. 太原东山晨恒选煤 新建年入洗120万吨煤炭洗选项目（EPC，含智能干选预排矸） —— 招标公告
  {
    title: '太原东山晨恒选煤有限公司新建年入洗120万吨煤炭洗选项目 (不分标段)招标公告',
    url: 'https://prec.sxzwfw.gov.cn/jyxxgczb/1041702.jhtml',
    source: '山西省公共资源交易平台（官方公开）· 招标公告',
    sourceAuthority: '官方公开',
    bid: '招标公告', bidStatus: '招标公告',
    date: '2026-03-25', publishDate: '2026-03-25',
    region: '山西·太原', line: '智能干选预排矸+重介（EPC）',
    buyer: '太原东山东兴煤业有限公司',
    competitor: '尚未定标（招标公告）',
    amount: '未披露',
    amountNote: 'EPC总承包招标公告未披露合同估算/控制价；开标2026-04-24，截至2026-07-31未检索到中标结果公告',
    confidence: '中',
    evidence: '招标编号SXZZT20260003 / I1401000278000978002；建设地点太原市杏花岭区中涧河镇窑庄村；工艺“智能干选预排矸+重介分选+TBS分选+浮选”；新建智能干选预排矸车间；工期12个月',
    bidOpenDate: '2026-04-24', openStatus: '已开标',
    scopeNote: 'EPC总承包（含智能干选预排矸车间），中标人须同时具矿山施工与煤炭行业设计甲级资质，可联合体投标',
  },
  // 8. 东庞矿北井 干式智能选煤设备维修项目 —— 成交候选人公示
  {
    title: '东庞矿北井干式智能选煤设备维修项目成交候选人公示',
    url: 'https://www.jzbidding.com/cms/jzny/webfile/zd20=jsgczbhxr/20260709/1259880619375067136.html',
    source: '河北省招标投标公共服务平台（公开镜像）· 成交候选人公示',
    sourceAuthority: '公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-07-09', publishDate: '2026-07-09',
    region: '河北·邢台', line: '干式智能选煤设备维修',
    buyer: '东庞矿北井（冀中能源）',
    competitor: '邢台市金富电气机械有限公司',
    amount: '未披露',
    amountNote: '成交候选人公示，第一候选邢台市金富电气机械报价64.9863万元，尚未见成交结果公告',
    confidence: '中',
    evidence: '开标2026-07-03；成交候选人：邢台市金富电气机械有限公司 649863元（第一，得分81.25）；石家庄柯宇煤矿机械有限公司 652000元（第二，得分79.53）；服务期合同签订起15天',
    bids: [
      { rank: 1, company: '邢台市金富电气机械有限公司', quote: '64.99万元', quoteYuan: 649863, note: '推荐第一成交候选人' },
      { rank: 2, company: '石家庄柯宇煤矿机械有限公司', quote: '65.20万元', quoteYuan: 652000 },
    ],
  },
  // 9. 新疆哈密三塘湖 石头梅一号露天煤矿 830煤场机械选矸加工服务(二次) —— 中标候选人公示
  {
    title: '新疆哈密三塘湖能源开发建设有限责任公司石头梅一号露天煤矿830煤场机械选矸加工服务(二次)',
    url: 'http://xjygcg.com/jyxx/001001/001001003/20260702/5e108784-12f9-4d04-92d1-45b0aea50427.html',
    source: '新疆维吾尔自治区公共资源交易网（官方公开）· 中标候选人公示',
    sourceAuthority: '官方公开',
    bid: '中标候选人', bidStatus: '中标候选人',
    date: '2026-07-02', publishDate: '2026-07-02',
    region: '新疆·哈密', line: '机械选矸加工服务（外包）',
    buyer: '新疆哈密三塘湖能源开发建设有限责任公司',
    competitor: '唐山神州机械集团有限公司',
    amount: '未披露',
    amountNote: '候选人公示仅列候选供应商名称，未披露投标报价；截至2026-07-31未检索到中标结果公告',
    confidence: '中',
    evidence: '招标编号NER-JT-FW/2026035G；中标候选第1名唐山神州机械集团有限公司、第2名锡林郭勒盟神工制造有限公司、第3名唐山创新选煤设备有限公司；公示期2026-07-02至07-04',
    bids: [
      { rank: 1, company: '唐山神州机械集团有限公司', quote: '未披露', note: '候选人公示仅列名称未列报价' },
      { rank: 2, company: '锡林郭勒盟神工制造有限公司', quote: '未披露', note: '候选人公示仅列名称未列报价' },
      { rank: 3, company: '唐山创新选煤设备有限公司', quote: '未披露', note: '候选人公示仅列名称未列报价' },
    ],
  },
];

// ---------------- 写入 ----------------
const before = data.length;
let added = 0;
for (const r of ADD) {
  const dup = data.find(x => x.title === r.title);
  if (dup) { console.log('  跳过(标题已存在)：' + r.title.slice(0, 40)); continue; }
  data.push({ ...r, id: 'auto-' + stamp() });
  added++;
}

fs.writeFileSync(FLAT, JSON.stringify(data, null, 2), 'utf8');
console.log(`\nflat 记录：${before} → ${data.length}（新增 ${added} 条）`);
