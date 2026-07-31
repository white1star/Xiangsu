// 从公开平台补抓那几个"仅乙方宝有源、移除后消失"的核心项目
// 全部来源为公开/免费平台（省级公共资源交易、公共服务平台镜像、企业公开招标页），非付费墙
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));
const known = new Set(data.map(r => (r.url || '').replace(/\?.*$/, '')));

const added = [];
function add(rec) {
  const key = (rec.url || '').replace(/\?.*$/, '');
  if (known.has(key)) { console.log('   [跳过-已存在]', rec.title.slice(0, 40)); return; }
  known.add(key);
  added.push(rec);
  console.log(`   + [${rec.bid}] ${rec.title.slice(0, 44)} | ${rec.amount}`);
}

// 1) 达旺汪家寨新建智能干选系统 —— 贵州省公共资源交易（六盘水）公开招标计划
add({
  title: '贵州达旺矿业有限公司汪家寨煤矿新建智能干选系统项目 项目招标计划',
  url: 'http://ztb.guizhou.gov.cn/api/upload/preview/8e891c68-5f76-48d6-a7d3-680fb6c76ab5',
  date: '2026-07-17', publishDate: '2026-07-17',
  bid: '招标计划', bidStatus: '招标计划',
  line: '智能干选', competitor: null, buyer: '贵州达旺矿业有限公司汪家寨煤矿',
  amount: '4763.95万元', amountNote: '招标计划投资估算（原煤处理能力1100吨/小时，预计2026-08-17招标）',
  amountSrc: '贵州省公共资源交易平台（六盘水）· 公开招标计划',
  source: '贵州省公共资源交易平台（六盘水）· 公开招标计划',
  confidence: '高', evidence: '投资估算(万元) 4763.95；资金来源 单位自筹+银行贷款',
  digQuery: '汪家寨 智能干选系统', digProj: '达旺汪家寨新建干选',
});

// 2) 红会第一煤矿智能干选系统PC总承包 —— 甘肃经济信息网公开候选人公示
add({
  title: '甘肃靖煤能源有限公司红会第一煤矿分公司智能干选系统PC总承包项目 中标候选人公示',
  url: 'https://www.gsei.com.cn/html/1337/2026-07-28/content-689494.html',
  date: '2026-07-28', publishDate: '2026-07-28',
  bid: '中标候选人', bidStatus: '中标候选人',
  line: '智能干选', competitor: '甘肃煤炭第一工程有限责任公司', buyer: '甘肃靖煤能源有限公司红会第一煤矿分公司',
  amount: '1643.15万元', amountNote: '第一中标候选人报价（16431464.99元）；设计规模1.50Mt/a，PC总承包',
  amountSrc: '甘肃经济信息网· 公开候选人公示',
  source: '甘肃经济信息网· 公开候选人公示',
  confidence: '高', evidence: '001 1 甘肃煤炭第一工程有限责任公司 ... 投标报价(元) 16431464.99',
  digQuery: '红会第一煤矿 智能干选系统', digProj: '靖煤红会一矿PC总包',
});

// 3) 漳村煤矿2号智能干选机维保 —— 中国招标投标公共服务平台公开镜像（成交候选人）
add({
  title: '山西潞安环保能源开发股份有限公司漳村煤矿选矸车间2号智能干选机维保成交候选人公示',
  url: 'https://m.chinabidding.cn/zbgg/U-vz2sswo.html',
  date: '2026-07-13', publishDate: '2026-07-13',
  bid: '已中标', bidStatus: '已中标',
  line: '智能干选', competitor: '北京霍里思特科技有限公司', buyer: '山西潞安环保能源开发股份有限公司漳村煤矿',
  amount: '50.5万元', amountNote: '成交候选人公示：北京霍里思特科技有限公司 50.5万元（型号TT104-20-X）',
  amountSrc: '中国招标投标公共服务平台（公开镜像）· 成交候选人公示',
  source: '中国招标投标公共服务平台（公开镜像）· 成交候选人公示',
  confidence: '高', evidence: '北京霍里思特科技有限公司 中标总额 50.5万；项目 漳村煤矿选矸车间2号智能干选机维保(型号:TT104-20-X)',
  digQuery: '漳村煤矿 智能干选机 维保', digProj: '潞安漳村维保',
});

// 4) 兰阿煤业干法选煤设备 —— 甘肃经济信息网成交公示
add({
  title: '甘肃兰阿煤业有限责任公司 干法选煤设备采购项目成交公示',
  url: 'https://www.gsei.com.cn/html/1337/2026-06-30/content-681926.html',
  date: '2026-06-30', publishDate: '2026-06-30',
  bid: '已中标', bidStatus: '已中标',
  line: '智能干选', competitor: '唐山神州机械集团有限公司', buyer: '甘肃兰阿煤业有限责任公司',
  amount: '258万元', amountNote: '竞争性谈判成交金额 258.0000万元',
  amountSrc: '甘肃经济信息网· 成交公示',
  source: '甘肃经济信息网· 成交公示',
  confidence: '高', evidence: '成交人:唐山神州机械集团有限公司 成交金额:258.0000万元',
  digQuery: '兰阿煤业 干法选煤', digProj: '兰阿煤业干法选煤',
});

// 5) 坪上煤业TDS智能干选设备技术服务 —— 晋能控股招标采购平台公开页（最高限价）
add({
  title: '坪上煤业TDS智能干选设备技术服务(1标段)二次重新询比采购公告',
  url: 'https://wtjypt.com/trade/website/pages/article/caigouarticle.html?notid=69FF5BA092B64D189176EFE74D4FD04C&t=1784161248946&type=0',
  date: '2026-07-24', publishDate: '2026-07-24',
  bid: '招标公告', bidStatus: '招标公告',
  line: '智能干选', competitor: null, buyer: '山西晋煤集团坪上煤业有限公司',
  amount: '20万元', amountNote: '技术服务最高限价 ¥200000元（TDS18-100型智能干选设备，服务期1年）',
  amountSrc: '晋能控股招标采购平台（公开页）· 询比采购公告',
  source: '晋能控股招标采购平台（公开页）· 询比采购公告',
  confidence: '高', evidence: '本项目最高限价为人民币贰拾万元整(¥200000元)',
  digQuery: '坪上煤业 TDS 智能干选', digProj: '坪上煤业技术服务',
});

// 6) 党家河TDS智能干选系统 —— 设备招标失败（中原云商公开异常公告）
add({
  title: '鹤壁煤业(集团)有限责任公司设备采购党家河TDS智能干选系统异常公告',
  url: 'https://bid.zyepp.com/zbzq/001005/20260424/0812947f-c105-4c2a-ac15-513ef4a41356.html',
  date: '2026-04-24', publishDate: '2026-04-24',
  bid: '招标公告', bidStatus: '流标',
  line: '智能干选', competitor: null, buyer: '鹤壁煤业(集团)有限责任公司',
  amount: '未披露', amountNote: '2026-04-24开标投标人不足三家，公开招标失败（设备尚未采购）',
  amountSrc: '中原云商（公开）· 异常公告',
  source: '中原云商（公开）· 异常公告',
  confidence: '高', evidence: '至4月24日开标时间止，递交投标文件的投标人不足三家，本次公开招标失败',
  digQuery: '党家河 TDS 智能干选', digProj: '鹤壁党家河TDS施工',
});

// 7) 党家河TDS施工劳务 —— 直接采购成交（采购与招标网公开镜像）
add({
  title: '建设公司天宏钢构鹤壁煤业(集团)有限责任公司设备采购党家河 TDS 智能干选系统施工劳务询比价成交结果公告',
  url: 'https://wap.qianlima.com/gjxx/245248/index_10.html',
  date: '2026-07-25', publishDate: '2026-07-25',
  bid: '已中标', bidStatus: '已中标',
  line: '智能干选', competitor: '河南宝发建筑工程有限公司', buyer: '鹤壁煤业(集团)有限责任公司',
  amount: '未披露', amountNote: '施工劳务直接采购成交（设备招标已失败，此为土建施工劳务，非设备金额）',
  amountSrc: '采购与招标网（公开镜像）· 成交结果',
  source: '采购与招标网（公开镜像）· 成交结果',
  confidence: '中', evidence: '建设公司天宏钢构...党家河 TDS 智能干选系统施工劳务中标结果公示 成交人:河南宝发建筑工程有限公司',
  digQuery: '党家河 TDS 智能干选', digProj: '鹤壁党家河TDS施工',
});

// 8) 正升煤业智能干选系统改造设计 —— 中国招标投标公共服务平台公开采购公告
add({
  title: '山西汾西正升煤业有限责任公司动筛车间改造和智能干选系统改造设计采购公告',
  url: 'https://www.chinabidding.com.cn/dw_726_zbcgxxw/',
  date: '2026-07-27', publishDate: '2026-07-27',
  bid: '招标公告', bidStatus: '招标公告',
  line: '智能干选', competitor: null, buyer: '山西汾西正升煤业有限责任公司',
  amount: '未披露', amountNote: '企业自主采购非招标项目（设计采购），公开源未披露设计费金额，需抓详情页',
  amountSrc: '中国招标投标公共服务平台（公开镜像）· 采购公告',
  source: '中国招标投标公共服务平台（公开镜像）· 采购公告',
  confidence: '高', evidence: '山西汾西正升煤业有限责任公司动筛车间改造和智能干选系统改造设计采购公告 2026-07-27',
  digQuery: '正升煤业 智能干选系统改造', digProj: '汾西正升智能干选改造',
});

data.push(...added);
writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`\n==== 公开源补抓完成 ====`);
console.log(`新增公开记录: ${added.length} 条 -> flat 共 ${data.length} 条`);
