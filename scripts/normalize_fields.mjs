// 一次性归一化：产品线 / 竞品公司 / 中标人 / 候选名单公司
// 目标：把首页筛选栏里重复、带噪声后缀、没必要拆分的取值合并为规范值
// 仅改动平铺台账 intelligence.flat.json，末级由 group_projects.mjs 重新生成 intelligence.json
import { readFileSync, writeFileSync } from 'node:fs';

const FLAT = 'src/data/intelligence.flat.json';
const data = JSON.parse(readFileSync(FLAT, 'utf8'));

// ---------- 产品线：11 个变体 -> 2 个规范类 ----------
const LINE_CANON = ['煤炭智能干选设备', '矿石XRT光电分选设备'];
const LINE_MAP = {
  '智能干选': '煤炭智能干选设备',
  '智能干选机（设备购置）': '煤炭智能干选设备',
  '煤炭智能干选(EPC)': '煤炭智能干选设备',
  '智能选矸系统（设备采购）': '煤炭智能干选设备',
  '智能干选（设计前置）': '煤炭智能干选设备',
  '矿石智能分选设备': '矿石XRT光电分选设备',
  '矿石光电智能分选（非煤·海外）': '矿石XRT光电分选设备',
  'XRT矿石分选设备': '矿石XRT光电分选设备',
  '矿石智能光电分选（非煤·海外）': '矿石XRT光电分选设备',
  // 以下与规范值一致，仅作显式声明防止误判
  '矿石XRT光电分选(非煤)': '矿石XRT光电分选设备',
  '煤炭智能干选设备': '煤炭智能干选设备',
};
function normLine(v) {
  if (!v) return v;
  if (LINE_CANON.includes(v)) return v;
  if (LINE_MAP[v]) return LINE_MAP[v];
  return v; // 未知值保留并报警
}

// ---------- 竞品：去重 + 合并“未定标”占位 ----------
// 1) 占位/未披露 -> 未定标（这些详细短语是筛选栏噪音，且招标状态列已承载阶段信息）
const PLACEHOLDER = new Set([
  '（设计阶段，未定设备商）',
  '尚未定标（招标公告阶段）',
  '尚未定标（招标计划阶段）',
  '（待开标结果）',
  '（中标人：无）',
  '（招标计划，未定设备商）',
  '（流标，无中标方）',
  '尚未定标（招标公告）',
  '未披露',
]);
// 2) 同品牌多法律主体 -> 统一品牌/母公司名
function brandNorm(v) {
  if (!v) return v;
  if (/霍[里利]思特/.test(v)) return '霍里思特';
  if (/美腾/.test(v)) return '天津美腾科技股份有限公司';
  if (/东方测控/.test(v)) return '丹东东方测控技术股份有限公司';
  if (/澳兰/.test(v)) return '河北澳兰机械设备进出口有限公司';
  return v;
}
function normCompetitor(v) {
  if (!v) return v;
  if (PLACEHOLDER.has(v)) return '未定标';
  return brandNorm(v);
}

let lineChanged = 0, compChanged = 0, winChanged = 0, bidChanged = 0;
const lineBefore = {}, lineAfter = {}, compBefore = {}, compAfter = {};
for (const r of data) {
  if (r.line !== undefined) {
    const nl = normLine(r.line);
    if (nl !== r.line) { lineChanged++; lineBefore[r.line] = (lineBefore[r.line] || 0) + 1; lineAfter[nl] = (lineAfter[nl] || 0) + 1; r.line = nl; }
  }
  if (r.competitor !== undefined) {
    const nc = normCompetitor(r.competitor);
    if (nc !== r.competitor) { compChanged++; compBefore[r.competitor] = (compBefore[r.competitor] || 0) + 1; compAfter[nc] = (compAfter[nc] || 0) + 1; r.competitor = nc; }
  }
  if (r.winner !== undefined) {
    const nw = brandNorm(r.winner);
    if (nw !== r.winner) { winChanged++; r.winner = nw; }
  }
  if (Array.isArray(r.bids)) {
    for (const b of r.bids) {
      if (b && b.company) {
        const nb = brandNorm(b.company);
        if (nb !== b.company) { bidChanged++; b.company = nb; }
      }
    }
  }
}

writeFileSync(FLAT, JSON.stringify(data, null, 2));

console.log('=== 产品线 变更:', lineChanged, '条 ===');
console.log('  变体 -> 规范:');
for (const [k, v] of Object.entries(lineBefore)) console.log(`    ${k}  ×${v}  ->  煤炭智能干选设备/矿石XRT光电分选设备`);
console.log('=== 竞品 变更:', compChanged, '条 ===');
for (const [k, v] of Object.entries(compBefore)) console.log(`    合并: ${k}  ×${v}  ->  ${compAfter['未定标'] && k !== '未定标' ? (PLACEHOLDER.has(k) ? '未定标' : '品牌归一') : ''}`);
console.log('  中标人 变更:', winChanged, '条 | 候选名单公司 变更:', bidChanged, '条');
console.log('\n写入完成。下一步运行 group_projects.mjs 重新生成 intelligence.json。');
