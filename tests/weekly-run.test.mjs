import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditBidOpen, evaluateCoverage, mergeCandidates, nextScanState, rulesVersion, silentPlatforms, validateCandidate } from '../scripts/weekly-run.mjs';

const mandatory = [
  { id: 'ccteg', name: '中国煤科电子采购平台', required: true },
  { id: 'chnenergy', name: '国能e招', required: true },
];

test('blocks publication when a mandatory public source was not checked', () => {
  const report = evaluateCoverage(mandatory, [{ sourceId: 'ccteg', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 3 }]);
  assert.equal(report.publishable, false);
  assert.deepEqual(report.missing, ['国能e招']);
});

test('allows publication only after every mandatory source has a successful check', () => {
  const report = evaluateCoverage(mandatory, mandatory.map(source => ({ sourceId: source.id, status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 2 })));
  assert.equal(report.publishable, true);
  assert.equal(report.checked, 2);
});

// —— 门禁分层：能访问 ≠ 抓到东西 ——
test('a mandatory source that returns nothing blocks publication', () => {
  const checks = [
    { sourceId: 'ccteg', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 5 },
    { sourceId: 'chnenergy', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 0 },
  ];
  const report = evaluateCoverage(mandatory, checks);
  assert.equal(report.publishable, false, '抓到 0 条的必查源不能算通过');
  assert.deepEqual(report.missing, ['国能e招']);
});

test('zero-output mandatory sources are listed separately with their reason', () => {
  const sources = [
    { id: 'chnenergy', name: '国能e招', required: true },
    { id: 'zmzb', name: '中煤招标网', required: true, minDiscover: 0, zeroReason: '平台当期无相关公告' },
  ];
  const checks = [
    { sourceId: 'chnenergy', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 0 },
    { sourceId: 'zmzb', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 0 },
  ];
  const report = evaluateCoverage(sources, checks);
  assert.equal(report.publishable, false);
  assert.deepEqual(report.missing, ['国能e招']);
  assert.deepEqual(report.zeroOutput, [
    { name: '国能e招', id: 'chnenergy', discovered: 0, exempt: false, reason: '' },
    { name: '中煤招标网', id: 'zmzb', discovered: 0, exempt: true, reason: '平台当期无相关公告' },
  ], '零产出必查源全部列出，用 exempt 区分是否放行');
});

test('a mandatory source exempted with minDiscover 0 does not block publication', () => {
  const sources = [
    { id: 'chnenergy', name: '国能e招', required: true },
    { id: 'zmzb', name: '中煤招标网', required: true, minDiscover: 0, zeroReason: '平台当期无相关公告' },
  ];
  const checks = [
    { sourceId: 'chnenergy', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 4 },
    { sourceId: 'zmzb', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 0 },
  ];
  const report = evaluateCoverage(sources, checks);
  assert.equal(report.publishable, true, '显式豁免的源允许 0 产出');
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.zeroOutput, [
    { name: '中煤招标网', id: 'zmzb', discovered: 0, exempt: true, reason: '平台当期无相关公告' },
  ]);
});

test('a failed mandatory source is still missing even when exempt', () => {
  const sources = [{ id: 'zmzb', name: '中煤招标网', required: true, minDiscover: 0, zeroReason: '平台当期无相关公告' }];
  const checks = [{ sourceId: 'zmzb', status: 'failed', checkedAt: '2026-07-29T01:00:00Z', discovered: 0, failReason: '反爬拦截' }];
  const report = evaluateCoverage(sources, checks);
  assert.equal(report.publishable, false, '豁免只针对"抓得到但没货"，抓不到仍然阻塞');
  assert.deepEqual(report.missing, ['中煤招标网']);
  assert.deepEqual(report.zeroOutput, [], '访问失败的源不算零产出，归入 missing');
});

test('checks without discovered are treated as zero output', () => {
  const checks = [
    { sourceId: 'ccteg', status: 'ok', checkedAt: '2026-07-29T01:00:00Z', discovered: 1 },
    { sourceId: 'chnenergy', status: 'ok', checkedAt: '2026-07-29T01:00:00Z' },
  ];
  const report = evaluateCoverage(mandatory, checks);
  assert.equal(report.publishable, false, '没有 discovered 字段的老数据不能默认算通过');
  assert.deepEqual(report.missing, ['国能e招']);
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

test('auto-added 已中标 records carry winner so the project status guard stays green', () => {
  const { added } = mergeCandidates([], [
    {
      url: 'https://example.com/w', title: '某煤矿末煤干选设备租赁委外运营中标结果公示', source: '官方平台',
      publishDate: '2026-06-16', bidStatus: '已中标', sourceAuthority: 'official', competitor: '唐山神州机械集团有限公司',
      line: '煤炭智能干选设备', evidence: '中标人：唐山神州机械集团有限公司 中标金额：28369290元', evidenceCapturedAt: '2026-07-02T01:00:00Z',
    },
  ]);
  assert.equal(added[0].winner, '唐山神州机械集团有限公司');
});

test('deduplicates same notice appearing on two official platforms by title and date', () => {
  const existing = [{ id: 'old', url: 'https://province.example/x', title: '某矿干选机中标结果公告', publishDate: '2026-06-01' }];
  const result = mergeCandidates(existing, [
    { url: 'https://national.example/x', title: '某矿干选机中标结果公告', source: '全国平台', publishDate: '2026-06-01', bidStatus: '已中标', sourceAuthority: 'official', line: '煤炭智能干选设备', evidence: '中标人：某公司；中标价格：100万元。', evidenceCapturedAt: '2026-07-02T01:00:00Z' },
  ]);
  assert.equal(result.added.length, 0);
});

test('nextScanState 首次扫描写入 firstSeenAt，尚无产出时 lastNonZeroAt 为 null', () => {
  const next = nextScanState({}, [
    { sourceId: 'a', name: '甲平台', status: 'ok', checkedAt: '2026-09-29T06:00:00Z', pagesScanned: 2, discovered: 0, notes: [] },
  ]);
  assert.equal(next.a.firstSeenAt, '2026-09-29T06:00:00Z');
  assert.equal(next.a.lastNonZeroAt, null);
});

test('nextScanState 零发现不刷新 lastNonZeroAt（静默告警的数据地基）', () => {
  const previous = { a: { firstSeenAt: '2026-09-01T00:00:00Z', lastNonZeroAt: '2026-09-25T06:00:00Z' } };
  const next = nextScanState(previous, [
    { sourceId: 'a', name: '甲平台', status: 'ok', checkedAt: '2026-09-29T06:00:00Z', pagesScanned: 3, discovered: 0, notes: [] },
    { sourceId: 'b', name: '乙平台', status: 'ok', checkedAt: '2026-09-29T06:00:00Z', pagesScanned: 3, discovered: 2, notes: [] },
  ]);
  assert.equal(next.a.lastNonZeroAt, '2026-09-25T06:00:00Z', '零发现必须保留旧起点，否则静默告警永远不会触发');
  assert.equal(next.a.firstSeenAt, '2026-09-01T00:00:00Z', '已有 firstSeenAt 不被覆盖');
  assert.equal(next.b.lastNonZeroAt, '2026-09-29T06:00:00Z', '有发现时刷新起点');
  assert.equal(next.b.firstSeenAt, '2026-09-29T06:00:00Z');
});

test('silentPlatforms 边界：firstSeenAt 恰好 3 天整即报出（>=）', () => {
  const now = new Date('2026-09-29T06:00:00Z');
  const state = { a: { lastStatus: 'ok', discovered: 0, firstSeenAt: '2026-09-26T06:00:00Z', lastNonZeroAt: null } };
  assert.deepEqual(silentPlatforms(state, 3, now), ['a']);
});

test('silentPlatforms 默认阈值就是 3 天：3 天整报出、2.5 天不报', () => {
  const now = new Date('2026-09-29T06:00:00Z');
  const threeDays = { a: { lastStatus: 'ok', discovered: 0, firstSeenAt: '2026-09-26T06:00:00Z', lastNonZeroAt: null } };
  const twoAndHalfDays = { b: { lastStatus: 'ok', discovered: 0, firstSeenAt: '2026-09-26T18:00:00Z', lastNonZeroAt: null } };
  assert.deepEqual(silentPlatforms(threeDays, undefined, now), ['a'], '默认 days 下 3 天整必须报出（>=）');
  assert.deepEqual(silentPlatforms(twoAndHalfDays, undefined, now), [], '2.5 天不应报出（默认值不是 2）');
});

test('silentPlatforms 报出 3 天零产出的平台', () => {
  const now = new Date('2026-09-29T06:00:00Z');
  const state = {
    a: { lastStatus: 'ok', discovered: 0, firstSeenAt: '2026-09-01T00:00:00Z', lastNonZeroAt: '2026-09-25T06:00:00Z' },
    b: { lastStatus: 'ok', discovered: 3, firstSeenAt: '2026-09-01T00:00:00Z', lastNonZeroAt: '2026-09-29T06:00:00Z' },
  };
  assert.deepEqual(silentPlatforms(state, 3, now), ['a']);
});

test('silentPlatforms 不报从未见过的平台（未扫描不等于静默）', () => {
  const state = { c: { lastStatus: 'failed', firstSeenAt: '2026-09-01T00:00:00Z' } };
  assert.deepEqual(silentPlatforms(state, 3, new Date('2026-09-29T06:00:00Z')), []);
});

test('silentPlatforms 从 firstSeenAt 起算（新加入的平台不立刻报警）', () => {
  const state = { d: { lastStatus: 'ok', discovered: 0, firstSeenAt: '2026-09-28T00:00:00Z' } };
  assert.deepEqual(silentPlatforms(state, 3, new Date('2026-09-29T06:00:00Z')), []);
});

test('rulesVersion 同内容同版本、改内容即变', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-'));
  fs.writeFileSync(path.join(dir, 'scan-rules.json'), '[]');
  const v1 = rulesVersion(dir);
  assert.match(v1, /^rv-[0-9a-f]{10}$/);
  assert.strictEqual(v1, rulesVersion(dir));            // 同内容稳定
  fs.writeFileSync(path.join(dir, 'scan-rules.json'), '[{}]');
  assert.notStrictEqual(v1, rulesVersion(dir));         // 改内容即变
});

// —— 订阅制规则接入（防止"规则文件存在但没接进主流程"之类的静默漏接） ——
test('订阅规则文件可加载且与关键词规则合并成 78 条', () => {
  const scan = JSON.parse(fs.readFileSync(path.join('config', 'scan-rules.json'), 'utf8'));
  const subscribe = JSON.parse(fs.readFileSync(path.join('config', 'subscribe-rules.json'), 'utf8'));
  const keyword = Array.isArray(scan) ? scan : scan.rules;
  assert.equal(keyword.length, 59, '关键词规则数变化需同步更新此断言');
  assert.equal(subscribe.length, 19, '订阅规则数变化需同步更新此断言');
  assert.equal(keyword.length + subscribe.length, 78);
});

test('每条订阅规则都能被 runSubscribeAdapter 处理（结构与适配器契约一致）', () => {
  const subscribe = JSON.parse(fs.readFileSync(path.join('config', 'subscribe-rules.json'), 'utf8'));
  for (const rule of subscribe) {
    assert.ok(rule.id, `${rule.name || '?'} 缺 id`);
    assert.equal(rule.adapter, 'subscribe-list', `${rule.id} adapter 必须是 subscribe-list`);
    assert.ok(Array.isArray(rule.columns) && rule.columns.length > 0, `${rule.id} 必须定义 columns（订阅的栏目）`);
    assert.ok(Array.isArray(rule.include) && rule.include.length > 0, `${rule.id} 必须定义 include 词表`);
    assert.ok(Array.isArray(rule.exclude) && rule.exclude.length > 0, `${rule.id} 必须定义 exclude 词表`);
    for (const col of rule.columns) {
      assert.ok(col.url && /^https?:/.test(col.url), `${rule.id} 栏目 URL 不合法`);
    }
  }
});

test('订阅规则不参与覆盖率门禁（required 未设置，不阻塞发布）', () => {
  const subscribe = JSON.parse(fs.readFileSync(path.join('config', 'subscribe-rules.json'), 'utf8'));
  const bad = subscribe.filter(rule => rule.required);
  assert.deepEqual(bad, [], '订阅规则不应带 required（会阻塞发布）');
});
