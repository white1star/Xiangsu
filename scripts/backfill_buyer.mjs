// 补齐 buyer（采购方）与 competitor 空白
// 原则：buyer 一律取自公告标题/正文中明确出现的招标人主体，不做推测；
//      competitor 处于招标/计划阶段的，按事实写“尚未定标”而非留空。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(__dirname, '..', 'src', 'data', 'intelligence.flat.json');
const data = JSON.parse(fs.readFileSync(FLAT, 'utf8'));

// 标题关键词 -> 采购方主体（均来自公告标题/正文明示）
const BUYER = [
  [/铁煤集团/, '铁法煤业(集团)有限责任公司'],
  [/涡北选煤厂/, '淮北矿业股份有限公司涡北选煤厂'],
  [/淮南矿业.*物资采供中心|智能干选机升级改造/, '淮南矿业(集团)有限责任公司物资采供中心物资供销分公司'],
  [/挖金湾虎龙沟/, '大同煤矿集团挖金湾虎龙沟煤业有限公司'],
  [/胜利能源.*坑下干选/, '国家能源集团胜利能源有限公司'],
  [/簸箕掌煤业/, '山西煤炭运销集团簸箕掌煤业有限责任公司'],
  [/华晋明珠煤业/, '山西华晋明珠煤业有限责任公司'],
  [/中煤大同能源/, '中煤大同能源有限责任公司选煤厂'],
  [/西上庄煤矿/, '阳泉市南庄煤炭集团有限责任公司西上庄煤矿'],
  [/汝箕沟/, '国家能源集团宁夏煤业有限责任公司汝箕沟无烟煤分公司'],
  [/保康夏禹/, '保康夏禹矿业有限公司'],
  [/雁宝能源/, '雁宝能源内蒙古蒙东能源有限公司'],
  [/大南湖一矿/, '国源电力哈密煤电有限公司大南湖一矿'],
  [/西安科技大学/, '西安科技大学'],
  [/坪上煤业/, '山西坪上煤业有限公司'],
  [/达旺矿业|汪家寨煤矿/, '贵州达旺矿业有限公司汪家寨煤矿'],
];

let nb = 0, nc = 0;
for (const r of data) {
  const t = r.title || '';
  if (!r.buyer) {
    const hit = BUYER.find(([re]) => re.test(t));
    if (hit) { r.buyer = hit[1]; nb++; }
  }
  // 招标/计划阶段本就无中标人：写明事实，不留空
  if (!r.competitor) {
    if (/招标公告|招标计划/.test(r.bid || r.bidStatus || '')) {
      r.competitor = '尚未定标（' + (r.bid || r.bidStatus) + '阶段）';
      nc++;
    }
  }
}

fs.writeFileSync(FLAT, JSON.stringify(data, null, 2), 'utf8');
console.log(`补齐 buyer ${nb} 条、competitor ${nc} 条`);
