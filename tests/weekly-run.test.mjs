import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCoverage, mergeCandidates, validateCandidate } from '../scripts/weekly-run.mjs';

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
    publishDate: '2026-07-01', bidStatus: '已中标', sourceAuthority: 'official',
    evidence: '中标人：某设备有限公司；中标价格：7,540,000.00元。', evidenceCapturedAt: '2026-07-02T01:00:00Z',
  });
  assert.equal(result.valid, true);
});

test('merges only evidence-complete bidding candidates and prevents duplicate source links', () => {
  const existing = [{ id: 'old', url: 'https://example.com/a', title: '旧项目' }];
  const candidates = [
    { url: 'https://example.com/a', title: '重复', source: '来源', publishDate: '2026-07-01', bidStatus: '已中标', sourceAuthority: 'official', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
    { url: 'https://example.com/b', title: '缺发布日期', source: '来源', bidStatus: '已中标', sourceAuthority: 'official', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
    { url: 'https://example.com/c', title: '新中标项目', source: '来源', publishDate: '2026-07-02', bidStatus: '已中标', sourceAuthority: 'official', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
  ];
  const result = mergeCandidates(existing, candidates);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.added.map(record => record.url), ['https://example.com/c']);
  assert.equal(result.rejected.length, 1);
});
