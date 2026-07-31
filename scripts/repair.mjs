// 修复：用库内已存的“证据摘要”兜底补金额，并撤销误清除
import { readFileSync, writeFileSync } from 'node:fs';
import { extractAmount } from './amount-lib.mjs';

const SRC = 'src/data/intelligence.new.json';
const BAK = 'src/data/_bak_before_finalize.json';
const data = JSON.parse(readFileSync(SRC, 'utf8'));
const bak = JSON.parse(readFileSync(BAK, 'utf8'));
const K = (r) => (r.url || r.sourceUrl || r.link || '') + '|' + (r.title || '');
const bm = new Map(bak.map(r => [K(r), r]));

let fromEvidence = 0, restored = 0, stillUnd = 0;
const log = [];

for (const r of data) {
  if (!/未披露/.test(r.amount || '')) continue;
  const o = bm.get(K(r)) || {};
  const ev = [o.evidence, r.evidence, o.procurement, r.procurement].filter(Boolean).join(' ');

  // 1) 从证据摘要里抽金额（摘要常已含“第一候选人…报价305万元”）
  if (ev) {
    const a = extractAmount('', ev, r.bidStatus);
    if (a.amount) {
      r.amount = a.amount;
      r.amountNote = undefined; delete r.amountNote;
      r.amountSource = '官方公告摘要';
      fromEvidence++;
      log.push(`  ✓ ${a.amount.padEnd(13)} [摘要] ${(r.title || '').slice(0, 40)}`);
      continue;
    }
  }

  // 2) 撤销误清除：原有金额且数额合理（≥10万）则恢复
  const oldAmt = o.amount;
  if (oldAmt && !/未披露/.test(oldAmt)) {
    const m = /([\d,]+(?:\.\d+)?)\s*(万元|元)/.exec(oldAmt.replace(/,/g, ''));
    const yuan = m ? (m[2] === '万元' ? parseFloat(m[1]) * 10000 : parseFloat(m[1])) : 0;
    if (yuan >= 100000) {
      r.amount = oldAmt;
      delete r.amountNote;
      r.amountSource = '原公告（本轮复核时源站不可达，沿用上次核验值）';
      restored++;
      log.push(`  ↩ ${oldAmt.padEnd(13)} [恢复] ${(r.title || '').slice(0, 40)}`);
      continue;
    }
  }
  stillUnd++;
}

writeFileSync(SRC, JSON.stringify(data, null, 2));

const und = data.filter(x => /未披露/.test(x.amount || ''));
console.log('========== 修复结果 ==========');
console.log(`从证据摘要补回: ${fromEvidence} 条`);
console.log(`撤销误清除恢复: ${restored} 条`);
console.log(`最终有金额: ${data.length - und.length} / ${data.length} 条`);
console.log(`仍未披露: ${und.length} 条`);
console.log('\n明细:');
log.forEach(l => console.log(l));
const reasons = {};
und.forEach(r => { const k = r.amountNote || '未标注'; reasons[k] = (reasons[k] || 0) + 1; });
console.log('\n未披露原因分布:');
Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v} 条 — ${k}`));
