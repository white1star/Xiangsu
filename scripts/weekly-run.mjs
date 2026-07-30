import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFile = path.join(root, 'config', 'public-sources.json');
const dataFile = path.join(root, 'src', 'data', 'intelligence.json');
const reportFile = path.join(root, 'public', 'data', 'latest-run.json');

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
  if (candidate.evidence.replace(/\s/g, '').length < 16) return { valid: false, reason: '原文证据摘录过短' };
  if (!['招标中', '中标候选人', '已中标'].includes(candidate.bidStatus)) return { valid: false, reason: '不是允许入库的招投标状态' };
  return { valid: true };
}

export function mergeCandidates(existing, candidates) {
  const knownUrls = new Set(existing.map(record => record.url));
  const added = []; const rejected = [];
  for (const candidate of candidates) {
    const validation = validateCandidate(candidate);
    if (!validation.valid) { rejected.push({ ...candidate, reason: validation.reason }); continue; }
    if (knownUrls.has(candidate.url)) continue;
    knownUrls.add(candidate.url);
    added.push({ id: `auto-${Buffer.from(candidate.url).toString('base64url').slice(0, 14)}`, line: candidate.line || '待核实', competitor: candidate.competitor || '待核实', region: candidate.region || '待核实', amount: candidate.amount || '未披露', confidence: '高', ...candidate, date: candidate.publishDate });
  }
  return { records: [...existing, ...added], added, rejected };
}

function absoluteUrl(href, base) { try { return new URL(href, base).href; } catch { return null; } }

function discoverFromHtml(html, source) {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const keyword = new RegExp(source.keywords.join('|'), 'i');
  const candidates = [];
  for (const match of matches) {
    const title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!keyword.test(title)) continue;
    const context = html.slice(Math.max(0, match.index - 240), match.index + match[0].length + 240);
    const date = context.match(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}/)?.[0]?.replace(/[年/.]/g, '-').replace('月-', '-');
    candidates.push({ title, url: absoluteUrl(match[1], source.listingUrl), source: source.name, publishDate: date, bidStatus: /候选人/.test(title) ? '中标候选人' : /中标/.test(title) ? '已中标' : '招标中', line: source.line });
  }
  return candidates;
}

async function checkSource(source) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(source.listingUrl, { headers: { 'user-agent': 'Pixel-Intelligence-Monitor/1.0 (public-source-check)' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    return { sourceId: source.id, status: 'ok', checkedAt: startedAt, httpStatus: response.status, candidates: discoverFromHtml(html, source) };
  } catch (error) { return { sourceId: source.id, status: 'failed', checkedAt: startedAt, error: error.message, candidates: [] }; }
}

async function main() {
  const sources = JSON.parse(await readFile(sourceFile, 'utf8'));
  const existing = JSON.parse(await readFile(dataFile, 'utf8'));
  const checks = await Promise.all(sources.filter(source => source.access === 'anonymous').map(checkSource));
  const coverage = evaluateCoverage(sources.filter(source => source.access === 'anonymous'), checks);
  const candidates = checks.flatMap(check => check.candidates);
  const merged = mergeCandidates(existing, candidates);
  const report = { generatedAt: new Date().toISOString(), coverage, checks: checks.map(({ candidates: ignored, ...check }) => ({ ...check, discovered: checks.find(item => item.sourceId === check.sourceId).candidates.length })), discovered: candidates.length, added: merged.added.length, rejected: merged.rejected.length };
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  if (!coverage.publishable) { console.error(`覆盖率不达标：${coverage.missing.join('、')}`); process.exitCode = 2; return; }
  await writeFile(dataFile, JSON.stringify(merged.records, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
