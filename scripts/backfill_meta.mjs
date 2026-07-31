// 回填元数据：sourceAuthority(鉴权分类) + region(地区)
// 目标：消除 intelligence.json 中大面积空白的"鉴权分类/地区"列，
//       使每条记录都有可追溯的来源属性，数据更"稳重"。
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

// 鉴权分类：需登录(企业自建电子采购平台) / 官方公开(政府公共资源平台) / 公开(公开渠道或镜像)
function classifyAuth(source = '') {
  // 需登录优先（企业自建平台，看公告全文需账号）
  if (/国能e招|华能集团电子招投标|神华招标网|淮北矿业|中国煤科电子采购|鞍钢集团电子招标投标|山东产权交易中心/.test(source)) return '需登录';
  // 官方公开（政府公共资源交易平台）
  if (/全国公共资源交易平台/.test(source)) return '官方公开';
  // 其余公开渠道
  return '公开';
}

// 地区：优先从来源平台括号中的省份推断，否则按平台名映射
function regionFromSource(source = '') {
  const m = source.match(/[（(]([^）)]+)[）)]/);
  if (m) {
    const p = m[1];
    if (/山西/.test(p)) return '山西';
    if (/山东/.test(p)) return '山东';
    if (/甘肃/.test(p)) return '甘肃';
    if (/陕西/.test(p)) return '陕西';
    if (/新疆/.test(p)) return '新疆';
    if (/贵州/.test(p)) return '贵州';
    if (/河北/.test(p)) return '河北';
    if (/辽宁|鞍钢/.test(p)) return '辽宁';
    if (/内蒙古|蒙东/.test(p)) return '内蒙古';
  }
  if (/甘肃经济信息网/.test(source)) return '甘肃';
  if (/晋能控股/.test(source)) return '山西';
  if (/贵州省/.test(source)) return '贵州';
  if (/山西省招标投标/.test(source)) return '山西';
  if (/河北省招标投标/.test(source)) return '河北';
  if (/中原云商/.test(source)) return '河南';
  if (/淮北矿业/.test(source)) return '安徽';
  if (/中国煤科/.test(source)) return '北京';
  if (/国能e招|华能|神华|央企/.test(source)) return '央企(全国)';
  if (/中国招标投标公共服务平台|采购与招标网/.test(source)) return '全国';
  return '';
}

let nAuth = 0, nRegion = 0;
for (const r of data) {
  const auth = classifyAuth(r.source);
  if (r.sourceAuthority !== auth) { r.sourceAuthority = auth; nAuth++; }
  const reg = regionFromSource(r.source);
  if (!r.region && reg) { r.region = reg; nRegion++; }
}

writeFileSync(FLAT, JSON.stringify(data, null, 2));
console.log(`回填完成：sourceAuthority 更新 ${nAuth} 条，region 补全 ${nRegion} 条`);
