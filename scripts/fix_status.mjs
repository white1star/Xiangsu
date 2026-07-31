// 中标状态一致性校验与修复
// 规则：
//   R1 bidStatus=流标/废标/失败/终止 → bid='流标'，不得显示为招标中或已中标
//   R2 bid='已中标' 必须有 winner；能从 evidence 抽出就补，抽不到则降级为'中标候选人'
//   R3 evidence 只写"中标候选人公示"而无"中标结果/成交结果" → 不得标'已中标'
//   R4 bid 与 bidStatus 不一致时以更可靠者对齐
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(dir, '../src/data/intelligence.flat.json');
const data = JSON.parse(fs.readFileSync(FLAT, 'utf8'));

const log = [];
const note = (i, msg) => log.push(`[${i}] ${msg}`);

// 人工核定过的中标人/状态（依据公告原文，避免正则误抽）
const VERIFIED = [
  { match: /新疆中富矿业.*中标结果/, winner: '天津美腾科技股份有限公司', bid: '已中标' },
  { match: /淮北矿业.*天津美腾.*直接采购/, winner: '天津美腾科技股份有限公司', bid: '已中标' },
  { match: /漳村煤矿.*维保成交候选人公示/, winner: '北京霍里思特科技有限公司', bid: '中标候选人' },
];

// 清洗中标人字段中的残留虚词 / 括号截断
function cleanName(s = '') {
  let v = s.replace(/^[为是:：、\s]+/, '').replace(/[，。；;]+$/, '').trim();
  // 左括号未闭合（如"中煤第三建设（集团"）视为截断，剥掉残段
  if (/[（(]/.test(v) && !/[）)]/.test(v)) v = v.replace(/[（(][^）)]*$/, '');
  return v.trim();
}

// 截断修复：在证据全文里找以该前缀开头的完整公司名
function repairTruncated(name, ev = '') {
  const text = ev.replace(/&#xa0;|\s+/g, ' ');
  const stem = name.replace(/[（(][^）)]*$/, '');
  const m = text.match(new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\u4e00-\\u9fa5（）()]{0,20}?(?:有限公司|股份有限公司|有限责任公司|集团公司)'));
  return m ? m[0] : name;
}

// 从证据抽中标人
function pickWinner(ev = '', title = '') {
  const text = ev.replace(/&#xa0;|\s+/g, ' ');
  const pats = [
    /(?:中标单位|中标人|成交人|成交单位|中标供应商|成交供应商)\s*[:：]?\s*([\u4e00-\u9fa5（）()]{4,30}?(?:有限公司|股份有限公司|集团有限公司|有限责任公司|集团|研究院|设计院))/,
    /第一(?:中标)?候选人\s*[:：]?\s*([\u4e00-\u9fa5（）()]{4,30}?(?:有限公司|股份有限公司|有限责任公司|集团|研究院|设计院))/,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m) return cleanName(m[1]);
  }
  return '';
}

const FAIL_RE = /(招标失败|公开招标失败|流标|废标|终止公告|中止公告|采购失败|不足三家)/;
const WIN_RE = /(中标结果|成交结果|中标公告|成交公告|成交公示|中标通知)/;
const CAND_ONLY_RE = /中标候选人公示/;

for (let i = 0; i < data.length; i++) {
  const r = data[i];
  const ev = r.evidence || '';
  const title = r.title || '';
  const blob = title + ' ' + ev;

  // R0 清洗已有中标人 + 应用人工核定
  if (r.winner) {
    const full = repairTruncated(r.winner, ev);
    const c = cleanName(full);
    if (c !== r.winner) { note(i, `R0 清洗中标人："${r.winner}" → "${c}"`); r.winner = c; }
  }
  const v = VERIFIED.find(x => x.match.test(title));
  if (v) {
    if (r.winner !== v.winner || r.bid !== v.bid) {
      note(i, `R0 人工核定：${r.bid}/${r.winner || '空'} → ${v.bid}/${v.winner} | ${title.slice(0, 34)}`);
    }
    r.winner = v.winner;
    r.bid = v.bid;
    r.bidStatus = v.bid;
    continue;
  }

  // R1 流标
  if (FAIL_RE.test(r.bidStatus || '') || (FAIL_RE.test(blob) && !WIN_RE.test(title))) {
    if (r.bid !== '流标') {
      note(i, `R1 流标：bid ${r.bid} → 流标 | ${title.slice(0, 40)}`);
      r.bid = '流标';
      r.bidStatus = '流标';
    }
    r.winner = undefined;
    continue;
  }

  // R2 已中标必须有中标人
  if (r.bid === '已中标' && !r.winner) {
    const w = pickWinner(ev, title);
    if (w) {
      r.winner = w;
      note(i, `R2 补中标人：${w} | ${title.slice(0, 40)}`);
    } else if (CAND_ONLY_RE.test(ev) && !WIN_RE.test(ev)) {
      r.bid = '中标候选人';
      r.bidStatus = '中标候选人';
      note(i, `R3 仅候选人公示，降级为中标候选人 | ${title.slice(0, 40)}`);
    } else {
      note(i, `⚠ 已中标但无法确定中标人（保留，需人工核）| ${title.slice(0, 40)}`);
    }
  }

  // R4 对齐
  if (r.bidStatus === '中标结果') r.bidStatus = '已中标';
  if (r.bid !== r.bidStatus && ['中标候选人', '已中标'].includes(r.bidStatus)) {
    note(i, `R4 对齐：bid ${r.bid} → ${r.bidStatus} | ${title.slice(0, 40)}`);
    r.bid = r.bidStatus;
  }
}

// 党家河：设备采购流标；施工劳务是另一标的，明确标注避免误读为设备中标
const dj = data.find(r => /党家河/.test(r.title) && /施工劳务/.test(r.title));
if (dj) {
  dj.scopeNote = '本条为土建施工劳务标的（非智能干选设备）；同项目设备采购已于 2026-04-24 因投标人不足三家流标，设备尚未授标';
  dj.line = '土建施工劳务（关联标的）';
  dj.competitor = '河南宝发建筑工程有限公司';
  note('*', '党家河施工劳务条：标注为关联标的，与设备流标区分');
}

fs.writeFileSync(FLAT, JSON.stringify(data, null, 2), 'utf8');
console.log(log.join('\n'));
console.log(`\n共修正 ${log.length} 处，已写回 ${path.basename(FLAT)}`);
