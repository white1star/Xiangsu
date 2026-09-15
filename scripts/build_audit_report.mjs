// 生成台账核验矩阵报告（HTML）
// 用途：周度抓取后逐项目核对"信息是否齐全"，输出可离线查看的报告
// 输入: src/data/intelligence.json（分组后）
// 输出: reports/audit-matrix.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const rows = JSON.parse(readFileSync('src/data/intelligence.json', 'utf8'));
const stamp = JSON.parse(readFileSync('src/data/crawl_stamp.json', 'utf8'));
const hasAmt = p => p.amount && !/未披露/.test(p.amount);
const hasWinner = p => !!(p.winner || (p.competitor && !/未披露|未定标/.test(p.competitor)));
const DONE = ['已中标', '已签约', '已交付', '已投运'];
const isDone = p => DONE.includes(p.bidStatus || p.bid);

const buckets = {
  done: [],       // 已定标且金额、中标人齐全
  noAmount: [],   // 已定标但官方未披露金额
  noWinner: [],   // 有金额但中标人未明确
  pending: [],    // 招标中 / 候选未定标（含 resultGap 盯防）
};
for (const p of rows) {
  if (isDone(p)) (hasAmt(p) ? buckets.done : buckets.noAmount).push(p);
  else if (hasAmt(p)) buckets.noWinner.push(p);
  else buckets.pending.push(p);
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const total = rows.length;
const amtCover = rows.filter(hasAmt).length;
const winCover = rows.filter(hasWinner).length;
const gapCount = rows.filter(p => p.resultGap).length;

function table(list, cols) {
  return `<table><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}</tr></thead><tbody>${
    list.map(p => `<tr>${cols.map(c => `<td>${c.f(p)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

const fmt = {
  date: p => esc(p.date),
  buyer: p => esc((p.buyer || '未披露').slice(0, 26)),
  mineral: p => esc(p.mineral || '—'),
  comp: p => esc(p.competitor || '—'),
  amount: p => hasAmt(p) ? `<b>${esc(p.amount)}</b>` : `<span class="na">未披露</span>`,
  status: p => `<span class="badge">${esc(p.bid)}</span>`,
  title: p => `<a href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.title)}</a>`,
  stages: p => `${p.stages} 阶段`,
  note: p => esc((p.amountNote || p.statusNote || p.scopeNote || '—').slice(0, 70)),
  gap: p => p.resultGap ? '<span class="gap">⚠ 待反查结果</span>' : '—',
};

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>竞品情报台账核验矩阵 · ${esc(stamp.lastCrawl || '')}</title>
<style>
:root{--line:#e3e8ef;--ink:#1b2a3a;--muted:#6a7887;--blue:#1267c9;--bg:#f6f8fb;--green:#0f8a5f;--amber:#b06b00;--red:#c0392b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 "Microsoft YaHei",-apple-system,"Segoe UI",Arial,sans-serif}
.wrap{max-width:1500px;margin:0 auto;padding:28px 22px 60px}
h1{font-size:22px;margin:0 0 6px}
.sub{color:var(--muted);font-size:13px;margin-bottom:22px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:26px}
.kpi{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.kpi .n{font-size:24px;font-weight:700;letter-spacing:.4px}
.kpi .l{color:var(--muted);font-size:12px;margin-top:2px}
.kpi.good .n{color:var(--green)}.kpi.warn .n{color:var(--amber)}.kpi.info .n{color:var(--blue)}
section{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-bottom:20px}
h2{font-size:16px;margin:0 0 4px;display:flex;align-items:center;gap:8px}
h2 .cnt{margin-left:auto;font-size:12px;color:var(--muted);font-weight:400}
.desc{color:var(--muted);font-size:12.5px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{background:#f0f4f9;text-align:left;padding:8px 9px;font-weight:600;color:#40536a;white-space:nowrap;border-bottom:1px solid var(--line)}
td{padding:7px 9px;border-bottom:1px solid #eef2f7;vertical-align:top}
tr:hover td{background:#fafcff}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
.na{color:#9aa7b4}
.badge{display:inline-block;padding:1px 7px;border-radius:999px;background:#eef3f9;color:#40536a;font-size:11.5px;white-space:nowrap}
.gap{color:var(--red);font-weight:600;white-space:nowrap}
.note{color:var(--muted);font-size:11.5px}
footer{color:var(--muted);font-size:12px;text-align:center;margin-top:26px}
</style></head><body><div class="wrap">
<h1>竞品情报台账 · 项目核验矩阵</h1>
<div class="sub">唐山像素智能科技 · XRT矿石分选 / 煤炭智能干选设备采购情报　|　核验时间：${esc(stamp.lastCrawl || '—')}　|　平铺 ${total === rows.length ? '' : ''}共 ${total} 个项目</div>
<div class="kpis">
  <div class="kpi info"><div class="n">${total}</div><div class="l">项目总数</div></div>
  <div class="kpi good"><div class="n">${amtCover}</div><div class="l">金额已披露（${(amtCover / total * 100).toFixed(0)}%）</div></div>
  <div class="kpi good"><div class="n">${winCover}</div><div class="l">中标人已明确（${(winCover / total * 100).toFixed(0)}%）</div></div>
  <div class="kpi warn"><div class="n">${buckets.pending.length}</div><div class="l">招标/候选阶段（未定标）</div></div>
  <div class="kpi warn"><div class="n">${gapCount}</div><div class="l">待反查中标结果</div></div>
</div>

<section>
  <h2>① 信息完整 · 已定标 <span class="cnt">${buckets.done.length} 个项目</span></h2>
  <p class="desc">已有中标人/成交方，且公告披露了真实成交金额。</p>
  ${table(buckets.done, [
    { h: '日期', f: fmt.date }, { h: '采购人', f: fmt.buyer }, { h: '矿种', f: fmt.mineral },
    { h: '竞品/中标方', f: fmt.comp }, { h: '金额', f: fmt.amount }, { h: '状态', f: fmt.status },
    { h: '阶段', f: fmt.stages }, { h: '项目', f: fmt.title },
  ])}
</section>

<section>
  <h2>② 已定标 · 官方未披露金额 <span class="cnt">${buckets.noAmount.length} 个项目</span></h2>
  <p class="desc">中标人/成交方已明确，但公告正文未载明金额（候选公示不含报价、官网自宣不披露等）——已按“未披露”如实记录，不作推算。</p>
  ${table(buckets.noAmount, [
    { h: '日期', f: fmt.date }, { h: '采购人', f: fmt.buyer }, { h: '矿种', f: fmt.mineral },
    { h: '竞品/中标方', f: fmt.comp }, { h: '状态', f: fmt.status }, { h: '阶段', f: fmt.stages },
    { h: '未披露原因', f: fmt.note }, { h: '项目', f: fmt.title },
  ])}
</section>

<section>
  <h2>③ 未定标 · 招标/候选阶段 <span class="cnt">${buckets.noWinner.length + buckets.pending.length} 个项目</span></h2>
  <p class="desc">项目仍在招标或已出候选但未定标；标⚠者为发布已超 30 天仍无结果公告，建议反查官方原文。</p>
  ${table([...buckets.noWinner, ...buckets.pending], [
    { h: '日期', f: fmt.date }, { h: '采购人', f: fmt.buyer }, { h: '矿种', f: fmt.mineral },
    { h: '当前候选/竞品', f: fmt.comp }, { h: '金额', f: fmt.amount }, { h: '状态', f: fmt.status },
    { h: '阶段', f: fmt.stages }, { h: '盯防', f: fmt.gap }, { h: '项目', f: fmt.title },
  ])}
</section>

<footer>本报告由 scripts/build_audit_report.mjs 自动生成 · 数据源：src/data/intelligence.json</footer>
</div></body></html>`;

mkdirSync('reports', { recursive: true });
writeFileSync('reports/audit-matrix.html', html);
console.log('项目', total, '| 完整', buckets.done.length, '| 未披露金额', buckets.noAmount.length,
  '| 未定标', buckets.noWinner.length + buckets.pending.length, '| 待反查', gapCount);
console.log('已写出 reports/audit-matrix.html');
