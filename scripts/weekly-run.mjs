// 竞品公开情报采集编排器。
// 用法：node scripts/weekly-run.mjs            —— 每周增量（近14天窗口）
//       node scripts/weekly-run.mjs --backfill —— 2026 年历史补抓（2026-01-01 起）
// 产物：src/data/intelligence.json（高置信台账，仅官方原文）
//       src/data/pending-review.json（聚合线索待复核队列）
//       public/data/latest-run.json（本次覆盖报告）
//       public/data/scan-state.json（每平台最近扫描状态）

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, buildWindow, enrichFromOfficialDetail, MINIMUM_PUBLISH_DATE as MIN_DATE, VENDOR_AUTHORITY, WECHAT_AUTHORITY, classifyLine, mapVendorSignal, canonicalLine } from './collect-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rulesFile = path.join(root, 'config', 'scan-rules.json');
// 平铺台账（管道产物、增量合并基准）；intelligence.json 是分组视图，由 group_projects.mjs 生成
const flatFile = path.join(root, 'src', 'data', 'intelligence.flat.json');
const pendingFile = path.join(root, 'src', 'data', 'pending-review.json');
const wechatFile = path.join(root, 'src', 'data', 'wechat-leads.json');
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
  const isVendor = candidate.sourceAuthority === VENDOR_AUTHORITY;
  if (candidate.sourceAuthority !== 'official' && !isVendor) return { valid: false, reason: '缺少官方原文验证，聚合来源只能作为线索' };
  if (candidate.publishDate < MINIMUM_PUBLISH_DATE) return { valid: false, reason: `发布日期早于${MINIMUM_PUBLISH_DATE}` };
  if (candidate.evidence.replace(/\s/g, '').length < 16) return { valid: false, reason: '原文证据摘录过短' };
  // 官网/官方自媒体自宣：只认交易信号（中标/签约/交付/投运），置信度中；官方招采平台：招标/候选/中标，置信度高。
  const allowedBids = isVendor ? ['已中标', '中标候选人', '已签约', '已交付', '已投运'] : ['招标公告', '中标候选人', '已中标'];
  if (!allowedBids.includes(candidate.bidStatus)) return { valid: false, reason: '不是允许入库的招投标状态' };
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
    const isVendor = candidate.sourceAuthority === VENDOR_AUTHORITY;
    const record = {
      id: `auto-${Buffer.from(candidate.url).toString('base64url').slice(0, 14)}`,
      title: candidate.title,
      line: candidate.line || '待核实',
      competitor: candidate.competitor || '未披露',
      region: candidate.region || '待核实',
      mineral: candidate.mineral || '未披露',
      amount: candidate.amount || '未披露',
      amountNote: candidate.amount ? null : (candidate.amountNote || null),
      budget: candidate.budget || null,
      buyer: candidate.buyer || null,
      procurement: candidate.procurement || null,
      bidOpenDate: candidate.bidOpenDate || null,
      bid: candidate.bidStatus,
      bidStatus: candidate.bidStatus,
      source: candidate.source,
      sourceAuthority: isVendor ? VENDOR_AUTHORITY : '官方公开',
      date: candidate.publishDate,
      publishDate: candidate.publishDate,
      confidence: isVendor ? '中' : '高',
      url: candidate.url,
      evidence: candidate.evidence,
    };
    if (!record.amountNote) delete record.amountNote;
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
      status: '待复核', note: lead.note || '仅公开聚合索引，须反查官方原文后才能入高置信台账',
      firstSeenAt: new Date().toISOString(),
    });
  }
  return { leads: [...existingLeads, ...added], added };
}

// 公众号线索标题归一：搜狗会在关键词两侧插入高亮空格，且常带书名号/方括号前缀，统一清洗后再去重。
const normWechatTitle = t => String(t || '')
  .replace(/[\s\u3000（）()【】\[\]｜|·・,，。.、!！?？:：;；'"“”‘’<>《》\-—_]/g, '')
  .toLowerCase();

// 公众号低置信线索池（confidence=低）：只存标题+摘要+日期+公众号名+链接；正文须人工点开。
// 与高/中置信台账、聚合线索池三方去重：若某条已存在于台账（官方原文）则不再作为公众号线索。
export function mergeWechatLeads(existing, ledger, pendingLeads, leads) {
  const knownUrls = new Set([...existing, ...ledger, ...pendingLeads].map(item => item.url).filter(Boolean));
  const knownTitles = new Set([...existing, ...ledger, ...pendingLeads].map(item => normWechatTitle(item.title)).filter(Boolean));
  const added = [];
  for (const lead of leads) {
    const title = String(lead.title || '').trim();
    const key = normWechatTitle(title);
    if (!key || !lead.url || knownUrls.has(lead.url) || knownTitles.has(key)) continue;
    knownUrls.add(lead.url); knownTitles.add(key);
    // 搜狗链接前段高度相似（都是 https://weixin.sogou.com/link?url=dn9a...），取 base64 前几位会撞号，改用整串哈希。
    const leadId = createHash('sha1').update(lead.url).digest('hex').slice(0, 12);
    added.push({
      id: `wx-${leadId}`,
      title,
      url: lead.url,
      account: lead.account || '',
      summary: lead.summary || '',
      date: lead.publishDate,
      publishDate: lead.publishDate,
      line: lead.line || '待核实',
      bidStatus: lead.bidStatus || '交易信号',
      via: lead.via || '搜狗收录',
      query: lead.query || '',
      source: lead.source || '微信公众号',
      confidence: '低',
      note: '公众号线索：仅获标题/摘要，搜狗不提供正文，请点击链接自行查看；不作为交易凭证，须官方公告核验',
      firstSeenAt: new Date().toISOString(),
    });
  }
  return { leads: [...existing, ...added], added };
}

// 可选路径：若能找到已安装的公众号搜索技能（wechat-article-search），用其脚本按竞品名再扫一遍，
// 结果与搜狗适配器合并去重。CI 环境通常未安装该技能，此处静默跳过（不影响自动流水线）。
// 已安装的公众号搜索技能脚本路径（可选路径 A）；未安装则返回 null（CI 环境常见）。
export function resolveWechatSkillScript() {
  const script = process.env.WECHAT_SKILL_SCRIPT
    || path.join(os.homedir(), '.workbuddy', 'skills', 'wechat-article-search', 'scripts', 'search_wechat.js');
  return existsSync(script) ? script : null;
}

// 路径 A：用已安装的公众号搜索技能按竞品名扫一遍（结果与搜狗适配器合并去重）。
export async function collectWechatViaSkill(script, keywords, from) {
  if (!script) return { candidates: [], note: '未检测到公众号搜索技能脚本，跳过 skill 路径' };
  const { execFileSync } = await import('node:child_process');
  const candidates = [];
  for (const keyword of keywords) {
    let payload;
    try {
      const raw = execFileSync(process.execPath, [script, keyword, '-n', '10'], {
        cwd: path.dirname(script), encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
      });
      payload = JSON.parse(raw.slice(raw.indexOf('{')));
    } catch {
      continue;
    }
    for (const article of payload.articles || []) {
      const rawLine = classifyLine(`${article.title} ${article.summary || ''}`);
      if (!rawLine) continue;
      const signal = mapVendorSignal(article.title) || mapVendorSignal(article.summary || '');
      const publishDate = (article.datetime || '').slice(0, 10) || null;
      if (!signal || !publishDate || publishDate < from) continue;
      candidates.push({
        title: article.title, url: article.url, account: article.source || '',
        source: article.source ? `微信公众号·${article.source}` : '微信公众号',
        summary: article.summary || '', publishDate, line: canonicalLine(rawLine), bidStatus: signal,
        via: '公众号直搜', query: keyword, sourceAuthority: WECHAT_AUTHORITY,
      });
    }
    await sleep(800);
  }
  return { candidates, note: `skill 路径命中 ${candidates.length} 条` };
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

  // 公众号雷达双路互斥：若本机已安装公众号搜索技能，则竞品名交给 skill 路径（路径 A），
  // 适配器只扫设备词（路径 B，搜狗第三方收录），避免同源重复请求触发反爬。
  const wechatRule = rules.find(rule => rule.adapter === 'sogou-wechat');
  const skillScript = process.argv.includes('--no-wechat-skill') ? null : resolveWechatSkillScript();
  const skillVendorKeywords = wechatRule?.vendorKeywords || [];
  if (skillScript && wechatRule) wechatRule.vendorKeywords = [];
  let skillNote = skillScript ? '待执行' : '未检测到公众号搜索技能脚本，竞品名并入适配器检索';

  console.log(`模式：${mode}，时间窗：${window.from} ~ ${window.to}，规则数：${rules.length}`);
  const checks = [];
  for (const rule of rules) {
    console.log(`扫描 ${rule.name} …`);
    const check = await runRule(rule, window, mode);
    console.log(`  → ${check.status}，页数 ${check.pagesScanned}，发现 ${check.discovered}${check.error ? '，失败原因：' + check.error : ''}`);
    checks.push(check);
  }

  const officialCandidates = [];
  const vendorCandidates = [];
  const aggregatorLeads = [];
  const wechatCandidates = [];
  for (const check of checks) {
    const rule = rules.find(item => item.id === check.sourceId);
    for (const candidate of check.candidates) {
      if (candidate.sourceAuthority === VENDOR_AUTHORITY) { vendorCandidates.push(candidate); continue; }
      if (candidate.sourceAuthority === WECHAT_AUTHORITY) { wechatCandidates.push(candidate); continue; }
      // leadOnly：官方平台但只能拿到列表级数据（详情正文 JS 渲染/接口不可读），
      // 按数据铁律不进高置信台账，只作待复核线索。
      if (rule.leadOnly) { aggregatorLeads.push({ ...candidate, note: rule.leadNote || null }); continue; }
      if ((rule.sourceAuthority || 'official') === 'official' && candidate.sourceAuthority === 'official') officialCandidates.push(candidate);
      else aggregatorLeads.push(candidate);
    }
  }

  // 路径 A（可选）：本机装有公众号搜索技能时，按竞品名再扫一遍，结果并入公众号线索池。
  if (skillScript && wechatRule) {
    const lookback = wechatRule.lookbackDays ?? 120;
    const cutoff = new Date(`${window.to}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - lookback);
    const wechatFrom = cutoff.toISOString().slice(0, 10) < MINIMUM_PUBLISH_DATE ? MINIMUM_PUBLISH_DATE : cutoff.toISOString().slice(0, 10);
    const skillRun = await collectWechatViaSkill(skillScript, skillVendorKeywords, wechatFrom);
    skillNote = skillRun.note;
    wechatCandidates.push(...skillRun.candidates);
  }

  // 官方招采平台（高置信）+ 竞品官网/官方自媒体交易信号自宣（中置信）同批入库；聚合站仅作待复核线索。
  const evidenceCandidates = [...officialCandidates, ...vendorCandidates];
  const merged = mergeCandidates(existing, evidenceCandidates.filter(candidate => candidate.line && candidate.bidStatus));
  const scopeRejected = evidenceCandidates
    .filter(candidate => !candidate.line || !candidate.bidStatus)
    .map(candidate => ({ title: candidate.title, url: candidate.url, source: candidate.source, reason: !candidate.line ? '与两类设备无关或命中排除规则' : '公告类型不在收录范围（如流标/废标/资格预审）' }));
  const pending = mergePendingLeads(existingPending, merged.records, aggregatorLeads);
  // 公众号低置信线索（confidence=低）：与台账、聚合线索池三方去重后写独立文件 wechat-leads.json。
  const existingWechat = await readJson(wechatFile, []);
  const wechat = mergeWechatLeads(existingWechat, merged.records, pending.leads, wechatCandidates);

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
    wechatRadar: {
      note: skillNote,
      screened: wechatCandidates.length,
      added: wechat.added.length,
      total: wechat.leads.length,
    },
    totals: {
      discovered: checks.reduce((sum, check) => sum + check.discovered, 0),
      accepted: merged.added.length,
      acceptedWithAmount: merged.added.filter(record => record.amount && record.amount !== '未披露').length,
      vendorAccepted: merged.added.filter(record => record.sourceAuthority === VENDOR_AUTHORITY).length,
      pendingReviewAdded: pending.added.length,
      wechatLeadAdded: wechat.added.length,
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
  wechat.leads.sort((a, b) => String(b.publishDate || '').localeCompare(String(a.publishDate || '')));
  await writeFile(flatFile, JSON.stringify(merged.records, null, 2) + '\n');
  await writeFile(pendingFile, JSON.stringify(pending.leads, null, 2) + '\n');
  await writeFile(wechatFile, JSON.stringify(wechat.leads, null, 2) + '\n');
  // 固定末级步骤：按项目分组生成前端消费的 intelligence.json
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'group_projects.mjs')], { cwd: root, stdio: 'inherit' });
  console.log(JSON.stringify(report.totals));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
