import assert from 'node:assert/strict';
import test from 'node:test';
import { auditBidOpen, evaluateCoverage, mergeCandidates, validateCandidate } from '../scripts/weekly-run.mjs';

const mandatory = [
  { id: 'ccteg', name: '中国煤科电子采购平台', required: true },
  { id: 'chnenergy', name: '国能e招', required: true },
];

test('blocks publication when a mandatory public source was not checked', () => {
  const report = evaluateCoverage(mandatory, [{ sourceId: 'ccteg', status: 'ok', checkedAt: '2026-07-29T01:00:00Z' }]);
  assert.equal(report.publishable, false);
  assert.deepEqual(report.missing, ['国能e招']);
});

test('allows publication only after every mandatory source has a successful check', () => {
  const report = evaluateCoverage(mandatory, mandatory.map(source => ({ sourceId: source.id, status: 'ok', checkedAt: '2026-07-29T01:00:00Z' })));
  assert.equal(report.publishable, true);
  assert.equal(report.checked, 2);
});

test('rejects a candidate without an official original page and verbatim evidence', () => {
  const result = validateCandidate({
    url: 'https://aggregate.example/project/1', title: '智能干选机中标', source: '聚合站',
    publishDate: '2026-07-01', bidStatus: '已中标', sourceAuthority: 'aggregator', evidence: '中标了', evidenceCapturedAt: '2026-07-02T01:00:00Z',
  });
  assert.equal(result.valid, false);
  assert.match(result.reason, /官方原文/);
});

test('accepts a complete official bidding record with traceable evidence', () => {
  const result = validateCandidate({
    url: 'https://official.example/notice/1', title: '智能干选机采购中标公告', source: '官方采购平台',
    publishDate: '2026-07-01', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备',
    evidence: '中标人：某设备有限公司；中标价格：7,540,000.00元。', evidenceCapturedAt: '2026-07-02T01:00:00Z',
  });
  assert.equal(result.valid, true);
});

test('auditBidOpen derives open status and flags result gaps', () => {
  const today = '2026-07-30';
  const records = [
    { title: '甲煤矿智能干选机采购项目招标公告', bid: '招标公告', bidOpenDate: '2026-06-12', date: '2026-05-20' },
    { title: '乙煤矿干选设备招标公告', bid: '招标公告', bidOpenDate: '2026-08-10', date: '2026-07-20' },
    { title: '丙煤矿XRT分选机招标公告', bid: '招标公告', date: '2026-04-01' },
    { title: '甲煤矿智能干选机采购项目中标结果公告', bid: '已中标', date: '2026-06-30' },
  ];
  const { records: out, summary } = auditBidOpen(records, today);
  const a = out.find(r => r.title.startsWith('甲'));
  assert.equal(a.openStatus, '已开标');
  assert.equal(a.resultGap, false, '同项目已有中标结果，不应标记缺口');
  const b = out.find(r => r.title.startsWith('乙'));
  assert.equal(b.openStatus, '待开标');
  const c = out.find(r => r.title.startsWith('丙'));
  assert.equal(c.openStatus, '未披露');
  assert.equal(c.resultGap, false, '未披露开标日期不标记缺口');
  assert.equal(summary.opened, 1);
  assert.equal(summary.upcoming, 1);
  assert.equal(summary.undisclosed, 1);
});

test('rejects a record that is outside the two product lines', () => {
  const result = validateCandidate({
    url: 'https://official.example/notice/other', title: '办公家具采购中标公告', source: '官方采购平台',
    publishDate: '2026-07-01', bidStatus: '已中标', sourceAuthority: 'official', line: null,
    evidence: '中标人：某家具有限公司；中标价格：10万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z',
  });
  assert.equal(result.valid, false);
  assert.match(result.reason, /无关/);
});

test('rejects intelligence published before the 2026 scope boundary', () => {
  const result = validateCandidate({
    url: 'https://official.example/notice/old', title: '智能干选机中标公告', source: '官方采购平台',
    publishDate: '2025-12-31', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备',
    evidence: '中标人：某设备有限公司；中标价格：100万元。', evidenceCapturedAt: '2026-01-01T01:00:00Z',
  });
  assert.equal(result.valid, false);
  assert.match(result.reason, /2026-01-01/);
});

test('merges only evidence-complete bidding candidates and prevents duplicate source links', () => {
  const existing = [{ id: 'old', url: 'https://example.com/a', title: '旧项目' }];
  const candidates = [
    { url: 'https://example.com/a', title: '重复', source: '来源', publishDate: '2026-07-01', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
    { url: 'https://example.com/b', title: '缺发布日期', source: '来源', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
    { url: 'https://example.com/c', title: '新中标项目', source: '来源', publishDate: '2026-07-02', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
  ];
  const result = mergeCandidates(existing, candidates);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.added.map(record => record.url), ['https://example.com/c']);
  assert.equal(result.rejected.length, 1);
});

test('auto-added ledger records carry UI-compatible bid fields and amount defaults', () => {
  const { added } = mergeCandidates([], [
    { url: 'https://example.com/d', title: '干选机中标结果', source: '官方平台', publishDate: '2026-07-02', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
  ]);
  assert.equal(added[0].bid, '已中标');
  assert.equal(added[0].amount, '未披露');
  assert.equal(added[0].competitor, '未披露');
  assert.equal(added[0].confidence, '高');
  assert.equal(added[0].date, '2026-07-02');
});

test('tender announcements are labelled 招标公告 with 未披露 competitor (not 招标中/待开标)', () => {
  const { added } = mergeCandidates([], [
    { url: 'https://example.com/e', title: '干选机设备采购项目招标公告', source: '官方平台', publishDate: '2026-03-15', bidStatus: '招标公告', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '发布招标公告，投标截止详见正文。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
  ]);
  assert.equal(added.length, 1);
  assert.equal(added[0].bid, '招标公告');
  assert.equal(added[0].bidStatus, '招标公告');
  assert.equal(added[0].competitor, '未披露');
});

test('deduplicates same notice appearing on two official platforms by title and date', () => {
  const existing = [{ id: 'old', url: 'https://province.example/x', title: '某矿干选机中标结果公告', publishDate: '2026-06-01' }];
  const result = mergeCandidates(existing, [
    { url: 'https://national.example/x', title: '某矿干选机中标结果公告', source: '全国平台', publishDate: '2026-06-01', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
  ]);
  assert.equal(result.added.length, 0);
});
