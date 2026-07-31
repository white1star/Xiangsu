// 竞品公开情报采集编排器。
// 用法：node scripts/weekly-run.mjs            —— 每周增量（近14天窗口）
//       node scripts/weekly-run.mjs --backfill —— 2026 年历史补抓（2026-01-01 起）
// 产物：src/data/intelligence.json（高置信台账，仅官方原文）
//       src/data/pending-review.json（聚合线索待复核队列）
//       public/data/latest-run.json（本次覆盖报告）
//       public/data/scan-state.json（每平台最近扫描状态）

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, buildWindow, enrichFromOfficialDetail, MINIMUM_PUBLISH_DATE as MIN_DATE } from './collect-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rulesFile = path.join(root, 'config', 'scan-rules.json');
// 平铺台账（管道产物、增量合并基准）；intelligence.json 是分组视图，由 group_projects.mjs 生成
const flatFile = path.join(root, 'src', 'data', 'intelligence.flat.json');
const pendingFile = path.join(root, 'src', 'data', 'pending-review.json');
const reportFile = path.join(root, 'public', 'data', 'latest-run.json');
const stateFile = path.join(root, 'public', 'data', 'scan-state.json');

export const MINIMUM_PUBLISH_DATE = MIN_DATE;

export function evaluateCoverage(sources, checks) {
  const required = sources.filter(source => source.required);
  const successful = new Set(checks.filter(check => check.status === 'ok').map(check => check.sourceId));
  const missing = required.filter(source => !successful.has(source.id)).map(source => source.name);
  return { publishable: missing.length === 0, checked: successful.size, required: required.length, missing };
}

export function validateCandidate(candidate) {
  const required = ['url', 'title', 'source', 'publishDate', 'bidStatus', 'evidence', 'evidenceCapturedAt'];
  const missing = required.filter(key => !candidate[key]);
  if (missing.length) return { valid: false, reason: `缺少${missing.join('、')}` };
  if (candidate.sourceAuthority !== 'official') return { valid: false, reason: '缺少官方原文验证，聚合来源只能作为线索' };
  if (candidate.publishDate < MINIMUM_PUBLISH_DATE) return { valid: false, reason: `发布日期早于${MINIMUM_PUBLISH_DATE}` };
  if (candidate.evidence.replace(/\s/g, '').length < 16) return { valid: false, reason: '原文证据摘录过短' };
  if (!['招标公告', '中标候选人', '已中标'].includes(candidate.bidStatus)) return { valid: false, reason: '不是允许入库的招投标状态' };
  if (!candidate.line) return { valid: false, reason: '与XRT矿石分选/煤炭智能干选设备无关' };
  return { valid: true };
}

export function mergeCandidates(existing, candidates) {
  const knownUrls = new Set(existing.map(record => record.url));
  const knownKeys = new Set(existing.map(record => `${record.title}|${record.publishDate || record.date}`));
  const added = []; const rejected = [];
  for (const candidate of candidates) {
    const validation = validateCandidate(candidate);
    if (!validation.valid) { rejected.push({ title: candidate.title, url: candidate.url, source: candidate.source, reason: validation.reason }); continue; }
    const key = `${candidate.title}|${candidate.publishDate}`;
    if (knownUrls.has(candidate.url) || knownKeys.has(key)) continue;
    knownUrls.add(candidate.url); knownKeys.add(key);
    const record = {
      id: `auto-${Buffer.from(candidate.url).toString('base64url').slice(0, 14)}`,
      title: candidate.title,
      line: candidate.line || '待核实',
      competitor: candidate.competitor || '未披露',
      region: candidate.region || '待核实',
      amount: candidate.amount || '未披露',
      budget: candidate.budget || null,
      buyer: candidate.buyer || null,
      procurement: candidate.procurement || null,
      bidOpenDate: candidate.bidOpenDate || null,
      bid: candidate.bidStatus,
      bidStatus: candidate.bidStatus,
      source: candidate.source,
      date: candidate.publishDate,
      publishDate: candidate.publishDate,
      confidence: '高',
      url: candidate.url,
      evidence: candidate.evidence,
    };
    added.push(record);
  }
  return { records: [...existing, ...added], added, rejected };
}

export function mergePendingLeads(existingLeads, ledger, leads) {
  const known = new Set([...existingLeads.map(item => item.url), ...ledger.map(item => item.url)]);
  const added = [];
  for (const lead of leads) {
    if (!lead.line || !lead.bidStatus || !lead.url || known.has(lead.url)) continue;
    if (!lead.publishDate || lead.publishDate < MINIMUM_PUBLISH_DATE) continue;
    known.add(lead.url);
    added.push({
      title: lead.title, line: lead.line, bidStatus: lead.bidStatus, source: lead.source,
      publishDate: lead.publishDate, url: lead.url, confidence: '中',
      status: '待复核', note: '仅公开聚合索引，须反查官方原文后才能入高置信台账',
      firstSeenAt: new Date().toISOString(),
    });
  }
  return { leads: [...existingLeads, ...added], added };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normProject = t => (t || '').replace(/[（(]第[^)）]*[)）]/g, '').replace(/[（(][^)）]*次[)）]/g, '').replace(/\s+/g, '');

// 对台账中“招标公告”记录，比对开标日期与今天，派生 openStatus（已开标/待开标/未披露），
// 并标记 resultGap：已开标但台账无同项目中标候选/已中标记录（疑似结果未收录）。
export function auditBidOpen(records, today = new Date().toISOString().slice(0, 10)) {
  const resultRecords = [];
  const audit = [];
  for (const r of records) {
    const rec = { ...r };
    if (r.bid === '招标公告' || r.bidStatus === '招标公告') {
      const open = r.bidOpenDate || null;
      let openStatus = '未披露';
      if (open) openStatus = open < today ? '已开标' : '待开标';
      rec.openStatus = openStatus;
      let resultGap = false;
      if (openStatus === '已开标') {
        const key = normProject(r.title).slice(0, 14);
        const hasResult = records.some(o => o !== r && (o.bid === '中标候选人' || o.bid === '已中标') && normProject(o.title).includes(key.slice(0, 8)) && key.length >= 8);
        resultGap = !hasResult;
      }
      rec.resultGap = resultGap;
      audit.push({ title: r.title, publishDate: r.date || r.publishDate, bidOpenDate: open, openStatus, resultGap });
    }
    resultRecords.push(rec);
  }
  const opened = audit.filter(a => a.openStatus === '已开标').length;
  const upcoming = audit.filter(a => a.openStatus === '待开标').length;
  const undisclosed = audit.filter(a => a.openStatus === '未披露').length;
  return { records: resultRecords, audit, summary: { total: audit.length, opened, upcoming, undisclosed, resultGap: audit.filter(a => a.resultGap).length } };
}

// 补全缺失的开标日期：对“招标公告”且缺 bidOpenDate 的记录重新抓取官方原文抽取。
async function backfillBidOpenDates(records, limit = 30) {
  let done = 0;
  for (const r of records) {
    if (done >= limit) break;
    if ((r.bid === '招标公告' || r.bidStatus === '招标公告') && !r.bidOpenDate && r.url) {
      try {
        const cand = await enrichFromOfficialDetail({ url: r.url, bidStatus: '招标公告' }, r.url);
        if (cand.bidOpenDate) { r.bidOpenDate = cand.bidOpenDate; done += 1; }
      } catch { /* 抓取失败如实保留未披露 */ }
      await sleep(600);
    }
  }
  return done;
}

// 对台账中字段缺失（尤其金额/中标单位未披露、或招标公告缺预算/采购人）的已有记录，
// 用增强后的详情抽取逻辑重新抓取官方原文补全，最大化减少“未披露”。
async function reEnrichUndisclosed(records, limit = 80) {
  let done = 0;
  for (const r of records) {
    if (done >= limit) break;
    const needsAmount = !r.amount || r.amount === '未披露';
    const needsBudget = !r.budget;
    const needsComp = (!r.competitor || r.competitor === '未披露') && (r.bid === '中标候选人' || r.bid === '已中标');
    const needsBuyer = !r.buyer;
    const needsProc = !r.procurement;
    if (!r.url || (!needsAmount && !needsBudget && !needsComp && !needsBuyer && !needsProc)) continue;
    try {
      const cand = await enrichFromOfficialDetail({ url: r.url, bidStatus: r.bid, line: r.line }, r.url);
      if (cand.amount && cand.amount !== '未披露' && (!r.amount || r.amount === '未披露')) r.amount = cand.amount;
      if (cand.budget && !r.budget) r.budget = cand.budget;
      if (cand.competitor && cand.competitor !== '未披露' && (!r.competitor || r.competitor === '未披露')) r.competitor = cand.competitor;
      if (cand.buyer && !r.buyer) r.buyer = cand.buyer;
      if (cand.procurement && !r.procurement) r.procurement = cand.procurement;
      if (cand.bidOpenDate && !r.bidOpenDate) r.bidOpenDate = cand.bidOpenDate;
    } catch { /* 抓取失败保留原值 */ }
    done += 1;
    await sleep(600);
  }
  return done;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

async function runRule(rule, window, mode) {
  const startedAt = new Date().toISOString();
  const adapter = ADAPTERS[rule.adapter];
  if (!adapter) return { sourceId: rule.id, name: rule.name, status: 'failed', checkedAt: startedAt, error: `未知适配器 ${rule.adapter}`, pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  try {
    const limits = mode === 'backfill' ? { maxPages: rule.maxPages ?? 10, maxDetails: 250 } : { maxPages: Math.min(rule.maxPages ?? 3, 3), maxDetails: 30 };
    const output = await adapter(rule, window, limits);
    return { sourceId: rule.id, name: rule.name, status: 'ok', checkedAt: startedAt, pagesScanned: output.pagesScanned, discovered: output.discovered, candidates: output.candidates, notes: output.notes || [] };
  } catch (error) {
    return { sourceId: rule.id, name: rule.name, status: 'failed', checkedAt: startedAt, error: error.message, pagesScanned: 0, discovered: 0, candidates: [], notes: [] };
  }
}

async function main() {
  const mode = process.argv.includes('--backfill') ? 'backfill' : 'weekly';
  const window = buildWindow(mode);
  const rules = await readJson(rulesFile, []);
  const existing = await readJson(flatFile, []);
  const existingPending = await readJson(pendingFile, []);
  const previousState = await readJson(stateFile, {});

  console.log(`模式：${mode}，时间窗：${window.from} ~ ${window.to}，规则数：${rules.length}`);
  const checks = [];
  for (const rule of rules) {
    console.log(`扫描 ${rule.name} …`);
    const check = await runRule(rule, window, mode);
    console.log(`  → ${check.status}，页数 ${check.pagesScanned}，发现 ${check.discovered}${check.error ? '，失败原因：' + check.error : ''}`);
    checks.push(check);
  }

  const officialCandidates = [];
  const aggregatorLeads = [];
  for (const check of checks) {
    const rule = rules.find(item => item.id === check.sourceId);
    for (const candidate of check.candidates) {
      if ((rule.sourceAuthority || 'official') === 'official' && candidate.sourceAuthority === 'official') officialCandidates.push(candidate);
      else aggregatorLeads.push(candidate);
    }
  }

  const merged = mergeCandidates(existing, officialCandidates.filter(candidate => candidate.line && candidate.bidStatus));
  const scopeRejected = officialCandidates
    .filter(candidate => !candidate.line || !candidate.bidStatus)
    .map(candidate => ({ title: candidate.title, url: candidate.url, source: candidate.source, reason: !candidate.line ? '与两类设备无关或命中排除规则' : '公告类型不在收录范围（如流标/废标/资格预审）' }));
  const pending = mergePendingLeads(existingPending, merged.records, aggregatorLeads);

  // 核对开标日期：补全缺失开标日期并派生“已开标/待开标”状态。
  const backfilled = await backfillBidOpenDates(merged.records);
  // 对已有记录用增强后的抽取逻辑重新补全未披露字段（金额/预算/采购人/采购内容/中标单位）。
  const reEnriched = await reEnrichUndisclosed(merged.records);
  const audited = auditBidOpen(merged.records, window.to);
  merged.records = audited.records;

  const coverage = evaluateCoverage(rules, checks);
  const allRejected = [...merged.rejected, ...scopeRejected];
  const scanState = { ...previousState };
  for (const check of checks) {
    scanState[check.sourceId] = {
      name: check.name, lastScanAt: check.checkedAt, lastStatus: check.status,
      pagesScanned: check.pagesScanned, discovered: check.discovered,
      failReason: check.error || null, notes: check.notes,
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    window,
    coverage,
    bidOpenAudit: {
      generatedAt: new Date().toISOString(),
      today: window.to,
      backfilledOpenDates: backfilled,
      summary: audited.summary,
      entries: audited.audit,
    },
    platforms: checks.map(check => ({
      id: check.sourceId, name: check.name, status: check.status,
      pagesScanned: check.pagesScanned, discovered: check.discovered,
      accepted: merged.added.filter(record => check.candidates.some(candidate => candidate.url === record.url)).length,
      failReason: check.error || null, notes: check.notes, checkedAt: check.checkedAt,
    })),
    coveredByNational: rules.find(rule => rule.id === 'national-ggzy')?.covers || [],
    totals: {
      discovered: checks.reduce((sum, check) => sum + check.discovered, 0),
      accepted: merged.added.length,
      acceptedWithAmount: merged.added.filter(record => record.amount && record.amount !== '未披露').length,
      pendingReviewAdded: pending.added.length,
      rejected: allRejected.length,
      reEnriched,
    },
    rejected: allRejected,
  };

  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  await writeFile(stateFile, JSON.stringify(scanState, null, 2) + '\n');

  if (!coverage.publishable) {
    console.error(`覆盖率不达标，缺少必查平台成功记录：${coverage.missing.join('、')}`);
    process.exitCode = 2;
    return;
  }
  merged.records.sort((a, b) => String(b.publishDate || b.date).localeCompare(String(a.publishDate || a.date)));
  await writeFile(flatFile, JSON.stringify(merged.records, null, 2) + '\n');
  await writeFile(pendingFile, JSON.stringify(pending.leads, null, 2) + '\n');
  // 固定末级步骤：按项目分组生成前端消费的 intelligence.json
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'group_projects.mjs')], { cwd: root, stdio: 'inherit' });
  console.log(JSON.stringify(report.totals));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
