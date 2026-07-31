// 全量重抽：金额/中标人/采购人；并为仍未披露的记录标注确切原因
import { readFileSync, writeFileSync } from 'node:fs';
import {
  fetchSolid, extractAmount, extractWinnerName, extractBuyerName, sleep,
} from './amount-lib.mjs';

const SRC = 'src/data/intelligence.new.json';
const data = JSON.parse(readFileSync(SRC, 'utf8'));
const U = (r) => r.url || r.sourceUrl || r.link || '';

const stat = { total: data.length, filled: 0, kept: 0, reasons: {} };
const bump = (k) => { stat.reasons[k] = (stat.reasons[k] || 0) + 1; };
const changes = [];

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const isYfb = (r) => /yfbzb|qianlima/.test(hostOf(U(r)));
// 乙方宝反爬严格(整站468)，排到最后统一处理，避免拖慢并污染其它站点节奏
const order = [...data.filter(r => !isYfb(r)), ...data.filter(isYfb)];
let yfbFail = 0, yfbCooled = false;

console.log(`开始全量复核，共 ${data.length} 条（其它站 ${data.filter(r => !isYfb(r)).length} + 乙方宝 ${data.filter(isYfb).length}）\n`);

for (let i = 0; i < order.length; i++) {
  const r = order[i];
  const url = U(r);
  const had = r.amount && !/未披露/.test(r.amount);
  const oldAmount = r.amount;

  if (isYfb(r)) {
    if (!yfbCooled) { console.log('\n--- 进入乙方宝批次，冷却 120s 等待解封 ---'); await sleep(120000); yfbCooled = true; }
    if (yfbFail >= 3) {
      // 连续被封则不再无谓请求：按已核实事实标注（全文在登录墙后，公开部分无金额）
      const wan = /([\d.]+)万元/.exec(r.amount || '');
      const yuan = wan ? parseFloat(wan[1]) * 10000 : null;
      if (had && yuan !== null && yuan < 50000) {
        changes.push({ t: r.title, from: oldAmount, to: '未披露', src: '清除噪声' });
        r.amount = '未披露';
        r.amountNote = '聚合站全文需登录；原小额经判定为保证金类噪声，已清除';
        bump('全文需登录(聚合站付费墙)'); stat.kept++;
      } else if (!had) {
        r.amount = '未披露';
        r.amountNote = '聚合站全文需登录，公开部分无金额';
        bump('全文需登录(聚合站付费墙)'); stat.kept++;
      }
      continue;
    }
  }

  if (!url) { if (!had) { r.amount = '未披露'; r.amountNote = '无来源链接'; bump('无来源链接'); stat.kept++; } continue; }

  // 按域名限速：乙方宝反爬严格(HTTP 468)，必须放慢
  const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
  const slow = isYfb(r);
  const gap = slow ? 6000 : /ggzy\.gov\.cn/.test(host) ? 1000 : 1400;

  const res = await fetchSolid(url, {
    retries: slow ? 4 : 3,
    minBody: 500,
    baseDelay: slow ? 5000 : 1500,
  });

  if (!res.ok) {
    if (isYfb(r) && /468|403|429/.test(res.err || '')) yfbFail++;
    if (!had) {
      r.amount = '未披露';
      const why = res.err === 'pdf-only' ? '公告正文为PDF附件，HTML无金额'
        : /404|410/.test(res.err || '') ? '原公告链接已失效(404)'
        : /shell/.test(res.err || '') ? '页面正文为空壳/需登录'
        : `抓取失败(${res.err})`;
      r.amountNote = why; bump(why); stat.kept++;
    }
    process.stdout.write(`[${i + 1}/${order.length}] ✗ ${res.err} | ${(r.title || '').slice(0, 24)}\n`);
    await sleep(700);
    continue;
  }

  const a = extractAmount(res.html, res.body, r.bidStatus);
  const w = extractWinnerName(res.html, res.body);
  const b = extractBuyerName(res.body);

  if (a.amount) {
    if (!had) { changes.push({ t: r.title, from: oldAmount, to: a.amount, src: a.source }); stat.filled++; }
    else if (oldAmount !== a.amount) { changes.push({ t: r.title, from: oldAmount, to: a.amount, src: a.source + '·修正' }); }
    r.amount = a.amount;
    delete r.amountNote;
  } else if (had) {
    // 页面抓取正常却抽不到金额 → 旧值多半是保证金/注册资本等误抓，清除
    changes.push({ t: r.title, from: oldAmount, to: '未披露', src: '清除误抓' });
    r.amount = '未披露';
    r.amountNote = '公告正文确无金额信息（原值经复核为非交易金额，已清除）';
    bump('公告正文确无金额信息'); stat.kept++;
  } else {
    r.amount = '未披露';
    const why = /登\s*录后查看|请登录|会员可见|立即登录/.test(res.html) ? '全文需登录(聚合站付费墙)'
      : '公告正文确无金额信息';
    r.amountNote = why; bump(why); stat.kept++;
  }

  if (a.budget && !r.budget) r.budget = a.budget;
  if (w && (!r.competitor || /未披露/.test(r.competitor))) {
    r.competitor = /候选/.test(r.bidStatus || '') ? `${w}（第一候选人）` : w;
  }
  if (w && (!r.winner || /未披露/.test(r.winner || ''))) r.winner = w;
  if (b && !r.buyer) r.buyer = b;

  process.stdout.write(`[${i + 1}/${order.length}] ${a.amount ? '✓ ' + a.amount : '· 无金额'} | ${(r.title || '').slice(0, 24)}\n`);
  await sleep(gap);
}

writeFileSync(SRC, JSON.stringify(data, null, 2));

const und = data.filter(x => /未披露/.test(x.amount || ''));
console.log('\n========== 汇总 ==========');
console.log(`总记录: ${stat.total}`);
console.log(`有金额: ${data.length - und.length} 条  |  未披露: ${und.length} 条`);
console.log(`本轮新补金额: ${stat.filled} 条`);
console.log('\n仍未披露的原因分布:');
for (const [k, v] of Object.entries(stat.reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${v} 条 — ${k}`);
console.log('\n本轮补上的金额（样例前25）:');
changes.slice(0, 25).forEach(c => console.log(`  ${c.to.padEnd(14)} [${c.src}] ${(c.t || '').slice(0, 40)}`));
