// 定向反查（旧账更新常态化）：
// 对台账中未完结项目（招标/候选/待反查）逐项在公开可检索源做定向复查，找同项目的后续"结果类"公告。
// 用法：node scripts/recheck_unresolved.mjs [--apply] [--limit N]
//   --apply  对命中的官方/公开源结果公告回填台账（须原文证据、模糊去重、自动备份 + 重生成分组）
// 数据源（node 直连）：全国公共资源交易平台接口 / 必联检索 / 国信e采检索 / 十环检索（仅线索，不回填）
// 华能走浏览器桥（较慢），本脚本默认不跑；需要时另行用 scrapling 规则复查。

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runHtmlListAdapter, classifyLine, mapBidStatus, enrichFromOfficialDetail } from './collect-lib.mjs';
import { mergeCandidates } from './weekly-run.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flatFile = path.join(root, 'src', 'data', 'intelligence.flat.json');
const groupedFile = path.join(root, 'src', 'data', 'intelligence.json');
const rulesFile = path.join(root, 'config', 'scan-rules.json');
const reportDir = path.join(root, 'reports');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitArg = args.find(a => a.startsWith('--limit'));
const limit = limitArg ? Number(limitArg.split('=')[1] || args[args.indexOf(limitArg) + 1]) || 14 : 14;
const today = new Date().toISOString().slice(0, 10);
const cutoff = new Date(Date.now() - 21 * 86400 * 1000).toISOString().slice(0, 10);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------- 1. 目标选择：未完结项目 ----------
const projects = JSON.parse(readFileSync(groupedFile, 'utf8'));
const OPEN_STAGES = new Set(['招标公告', '中标候选人', '招标', '招标（EPC）', '招标计划']);
const targets = projects
  .filter(p => OPEN_STAGES.has(p.bidStatus || p.bid) || p.resultGap)
  .filter(p => (p.date || '') <= cutoff)
  .filter(p => p.title && p.date)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  .slice(0, limit);

console.log(`未完结/待反查目标：${targets.length} 个（截至 ${cutoff} 仍无结果的，取最早 ${limit} 个）`);
if (!targets.length) process.exit(0);

// ---------- 2. 检索词提取 ----------
const BUYER_NOISE = ['有限责任公司', '股份有限公司', '有限公司', '集团', '矿业', '煤业', '能源', '煤电', '煤化工', '煤焦化', '矿业公司', '煤业公司', '煤炭', '公司'];
const TITLE_NOISE = ['招标公告', '中标公告', '中标结果公示', '中标结果公告', '中标候选人公示', '评标结果公示', '成交公告', '成交结果公示', '候选人公示', '定标结果公示', '资格预审公告', '招标预审公告', '采购公告', '二次', '重新招标', '重新公告', '招标', '采购', '项目公告', '公开', '项目', '系统', '设备', '工程', '改造', '采购项目', '智能干选机', '智能干选系统', '智能干选设备', '智能干选', '干选机', '干选系统', '干选设备', '干选', '光电分选机', '光电智能分选', '光电分选', '智能分选', 'XRT', 'TDS', '智能选矸', '选矸', '抛废'];
const PROVINCE_PREFIX = ['中国', '陕西', '山西', '甘肃', '宁夏', '新疆', '内蒙古', '河北', '河南', '山东', '安徽', '江苏', '贵州', '云南', '四川', '辽宁', '黑龙江', '青海', '湖南', '湖北', '江西', '福建', '广东', '广西', '浙江', '海南', '吉林'];

function stripNoise(text, noiseList) {
  let value = String(text || '');
  for (const noise of noiseList) value = value.split(noise).join('|');
  return value.split('|').map(s => s.trim()).filter(Boolean);
}

function deriveTerms(project) {
  const terms = [];
  // 采购人核心词
  let buyer = String(project.buyer || '').trim();
  for (const prefix of PROVINCE_PREFIX) { if (buyer.startsWith(prefix) && buyer.length > prefix.length + 2) { buyer = buyer.slice(prefix.length); break; } }
  for (const core of stripNoise(buyer, BUYER_NOISE)) { if (core.length >= 3 && !/^[（(]/.test(core)) terms.push(core); }
  // 标题特征词（去掉产品/类型噪声后剩的最长片段）
  const chunks = stripNoise(project.title, TITLE_NOISE).filter(s => s.length >= 3 && !/^\d+$/.test(s) && !/^[\s\-—·、,，。;；:：]+$/.test(s) && !/^第.{0,2}次$/.test(s) && !/^(二次|重新|再次|中标|成交|公告|公示)$/.test(s));
  chunks.sort((a, b) => b.length - a.length);
  for (const chunk of chunks.slice(0, 2)) terms.push(chunk.slice(0, 16));
  return [...new Set(terms)].slice(0, 3);
}

// ---------- 3. 复查源 ----------
const rules = JSON.parse(readFileSync(rulesFile, 'utf8'));
const ebnewRule = rules.find(r => r.id === 'ebnew-search');
const ebiddingRule = rules.find(r => r.id === 'ebidding-search');
const shihuanRule = rules.find(r => r.id === 'shihuan-search');

async function searchGgzy(term, fromDate) {
  const form = new URLSearchParams({ DEAL_TIME: '06', TIMEBEGIN: fromDate, TIMEEND: today, FINDTXT: term, PAGENUMBER: '1' });
  const res = await fetch('https://www.ggzy.gov.cn/information/pubTradingInfo/getTradList', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: 'https://www.ggzy.gov.cn/deal/dealList.html', 'user-agent': 'Mozilla/5.0 Chrome/126' },
    body: form.toString(), signal: AbortSignal.timeout(30000),
  });
  const payload = await res.json();
  if (payload.code !== 200) throw new Error(`ggzy code=${payload.code}`);
  return (payload.data?.records || []).map(r => ({
    title: r.title, date: (r.publishTime || '').slice(0, 10),
    url: 'https://www.ggzy.gov.cn' + String(r.url || '').replace('/html/a/', '/html/b/'),
    source: '全国公共资源交易平台', authority: 'official',
  }));
}

async function searchAdapter(rule, term) {
  if (!rule) return [];
  const result = await runHtmlListAdapter({ ...rule, keywords: [term], maxPages: 1 }, { from: '2026-01-01', to: today }, { maxPages: 1, maxDetails: 0 });
  return result.candidates.map(c => ({ title: c.title, date: c.publishDate, url: c.url, source: rule.name, authority: c.sourceAuthority }));
}

const RESULT_TYPES = /中标|成交|结果|候选人/;
const PRODUCT_PATTERN = /干选|分选|选矸|XRT|光电|抛废|TDS/;

function isNewResult(hit, project, existing) {
  if (!hit.date || hit.date < (project.date || '')) return false;
  if (!RESULT_TYPES.test(hit.title)) return false;
  if (existing.urls.has(hit.url)) return false;
  const key = `${normTitle(hit.title)}|${hit.date}`;
  if (existing.keys.has(key)) return false;
  return true;
}

// 相关性收紧：命中标题必须同时含「产品词」和「项目特征词」（防撞名，如"郭家河"湿地/桥梁）
function isRelevant(hit, terms) {
  if (!PRODUCT_PATTERN.test(hit.title)) return false;
  return terms.some(term => term.length >= 3 && hit.title.includes(term));
}

const normTitle = value => String(value || '').replace(/[【】[\]（）()\s\u3000]/g, '').replace(/中标公示/g, '中标结果公示');
const flat = JSON.parse(readFileSync(flatFile, 'utf8'));
const existing = {
  urls: new Set(flat.map(r => r.url)),
  keys: new Set(flat.map(r => `${normTitle(r.title)}|${r.publishDate || r.date}`)),
};

// ---------- 4. 逐目标复查 ----------
const report = { generatedAt: new Date().toISOString(), mode: apply ? 'apply' : 'dry-run', targets: [] };
const applyCandidates = [];
for (const project of targets) {
  const terms = deriveTerms(project);
  const entry = { project: project.title, date: project.date, bidStatus: project.bidStatus || project.bid, buyer: project.buyer || null, terms, hits: [], note: null };
  if (!terms.length) { entry.note = '未能提取有效检索词'; report.targets.push(entry); continue; }
  for (const term of terms) {
    const buckets = [];
    try { buckets.push(...await searchGgzy(term, project.date)); } catch (e) { entry.note = (entry.note ? entry.note + '；' : '') + `ggzy(${term})失败：${e.message}`; }
    for (const rule of [ebnewRule, ebiddingRule, shihuanRule]) {
      try { buckets.push(...await searchAdapter(rule, term)); } catch (e) { entry.note = (entry.note ? entry.note + '；' : '') + `${rule.id}(${term})失败：${e.message}`; }
      await sleep(600);
    }
    for (const hit of buckets) {
      if (!isNewResult(hit, project, existing)) continue;
      if (!isRelevant(hit, terms)) continue;
      hit.term = term;
      entry.hits.push(hit);
      existing.urls.add(hit.url);
      existing.keys.add(`${normTitle(hit.title)}|${hit.date}`);
    }
    await sleep(500);
  }
  const mark = entry.hits.length ? `发现 ${entry.hits.length} 条候选` : '未发现后续公告';
  console.log(`- [${project.date}] ${String(project.title).slice(0, 34)} → ${mark}`);
  for (const hit of entry.hits) console.log(`    · [${hit.date}] ${hit.title.slice(0, 56)} | ${hit.source}`);
  report.targets.push(entry);
}

// ---------- 5. 可选回填（仅官方/公开源；聚合站线索不回填） ----------
if (apply) {
  const candidates = [];
  for (const entry of report.targets) {
    for (const hit of entry.hits) {
      if (hit.source.includes('十环')) continue;
      candidates.push({ title: hit.title, url: hit.url, source: hit.source, publishDate: hit.date, region: '待核实' });
    }
  }
  for (const candidate of candidates) {
    const line = classifyLine(candidate.title);
    const bidStatus = mapBidStatus(candidate.title);
    if (!line || !bidStatus || !['已中标', '中标候选人'].includes(bidStatus)) continue;
    applyCandidates.push({
      title: candidate.title, url: candidate.url, source: candidate.source, publishDate: candidate.publishDate,
      region: candidate.region || '待核实', line, bidStatus, sourceAuthority: candidate.authority || 'official',
    });
  }
  // 详情增强（证据）后合并
  for (const candidate of applyCandidates) { await enrichFromOfficialDetail(candidate, candidate.url); await sleep(600); }
  const fresh = applyCandidates.filter(c => c.evidence && c.evidence.replace(/\s/g, '').length >= 16);
  const merged = mergeCandidates(flat, fresh);
  if (merged.added.length) {
    const backupName = `_bak_flat_${today.replace(/-/g, '')}_recheck.json`;
    copyFileSync(flatFile, path.join(root, 'src', 'data', backupName));
    writeFileSync(flatFile, JSON.stringify(merged.records, null, 2) + '\n');
    console.log(`\n已回填 ${merged.added.length} 条（备份 ${backupName}）：`);
    for (const record of merged.added) console.log(`  + [${record.publishDate}] ${record.title.slice(0, 60)} | ${record.competitor} | ${record.amount}`);
    execFileSync(process.execPath, [path.join(root, 'scripts', 'group_projects.mjs')], { cwd: root, stdio: 'inherit' });
  } else {
    console.log('\n回填：0 条（候选经校验/去重后无新增）');
  }
  report.applied = merged.added.map(r => ({ title: r.title, publishDate: r.publishDate, url: r.url }));
}

// ---------- 6. 报告 ----------
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const reportFile = path.join(reportDir, `recheck-${today}.json`);
writeFileSync(reportFile, JSON.stringify(report, null, 1), 'utf8');
console.log(`\n报告：reports/recheck-${today}.json（${report.targets.length} 个目标，${report.targets.reduce((s, t) => s + t.hits.length, 0)} 条候选命中）`);
