import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWindow, classifyLine, extractAmount, extractWinner, mapBidStatus, normalizeDate } from '../scripts/collect-lib.mjs';
import { mergePendingLeads } from '../scripts/weekly-run.mjs';

test('normalizeDate handles Chinese and dash formats', () => {
  assert.equal(normalizeDate('2026年6月3日'), '2026-06-03');
  assert.equal(normalizeDate('2026-06-16 12:06'), '2026-06-16');
  assert.equal(normalizeDate('发布于2026/1/9'), '2026-01-09');
  assert.equal(normalizeDate('无日期'), null);
});

test('classifyLine keeps only the two product lines and excludes own company', () => {
  assert.equal(classifyLine('保德选煤厂智能干选机采购'), '煤炭智能干选设备');
  assert.equal(classifyLine('某钨矿XRT智能分选设备采购'), 'XRT矿石分选设备');
  assert.equal(classifyLine('磷矿山智能分选系统招标'), 'XRT矿石分选设备');
  assert.equal(classifyLine('唐山像素智能干选机中标'), null, '必须排除唐山像素智能自身');
  assert.equal(classifyLine('垃圾智能分选生产线采购'), null);
  assert.equal(classifyLine('办公楼保洁服务招标'), null);
});

test('mapBidStatus prioritises result notices and rejects failed tenders', () => {
  assert.equal(mapBidStatus('智能干选机采购项目中标候选人公示'), '中标候选人');
  assert.equal(mapBidStatus('智能干选机采购项目中标结果公告'), '已中标');
  assert.equal(mapBidStatus('TDS智能干选机配件直接采购公示'), '已中标');
  assert.equal(mapBidStatus('智能干选机维保技术服务询比采购公告'), '招标中');
  assert.equal(mapBidStatus('智能干选机采购项目流标公告'), null);
  assert.equal(mapBidStatus('智能干选机第一标段招标文件[20260511]'), null, '招标文件附件不入台账');
  assert.equal(mapBidStatus('TDS智能干选机设备采购项目开标记录'), null);
});

test('classifyLine ignores XRT inside project codes and magnetic separators', () => {
  assert.equal(classifyLine('中国电信NXRTKJGFYXGS全自动送餐采购项目'), null);
  assert.equal(classifyLine('项目编号YXRT2026ZC-01国土变更调查技术服务'), null);
  assert.equal(classifyLine('田兴铁矿旋转磁场干选机设备采购'), null, '磁选设备不属于XRT/智能干选范围');
  assert.equal(classifyLine('泊里煤矿井下智能分选系统带式输送机招标'), null, '输送机不是分选设备本体');
});

test('extractAmount only reads amounts explicitly disclosed in the notice text', () => {
  assert.equal(extractAmount('中标价格 2791300.0000元 工期90天').display, '279.13万元');
  assert.equal(extractAmount('成交金额：305万元').display, '305.00万元');
  assert.equal(extractAmount('本项目预算尚未披露'), null);
  assert.equal(extractAmount('投标报价 大写 贰佰柒拾玖万壹仟叁佰元整 小写 2791300.0000（元) 交货工期 90').display, '279.13万元');
  assert.equal(extractAmount('投标人名称 某建设公司 投标报价 392745562元 质量 合格').display, '39274.56万元');
  assert.equal(extractAmount('交货工期 90 日历天'), null, '不得把工期当金额');
});

test('extractWinner reads winner only from explicit disclosure', () => {
  assert.equal(extractWinner('中标单位 天津美腾科技股份有限公司 项目经理吕某'), '天津美腾科技股份有限公司');
  assert.equal(extractWinner('第一中标候选人：威海市海王科技有限公司，报价305万元'), '威海市海王科技有限公司');
  assert.equal(extractWinner('公告未披露供应商信息'), null);
  assert.equal(extractWinner('中标候选人公示 第一名 单位名称 天津美腾科技股份有限公司 投标报价'), '天津美腾科技股份有限公司');
  assert.equal(extractWinner('中标候选人名称 资质 排序 001 1 甘肃煤炭第一工程有限责任公司 建筑工程施工总承包'), '甘肃煤炭第一工程有限责任公司');
  assert.equal(extractWinner('中标候选人名称*河北澳兰机械设备进出口有限公司 报价 868000元'), '河北澳兰机械设备进出口有限公司', '须剥离表格标签前缀');
});

test('buildWindow enforces the 2026 scope floor', () => {
  const backfill = buildWindow('backfill', new Date('2026-07-30T00:00:00Z'));
  assert.equal(backfill.from, '2026-01-01');
  const weekly = buildWindow('weekly', new Date('2026-01-05T00:00:00Z'));
  assert.equal(weekly.from, '2026-01-01', '每周窗口不得早于2026-01-01');
});

test('mergePendingLeads keeps aggregator leads out of the high-confidence ledger', () => {
  const ledger = [{ url: 'https://official.example/1' }];
  const { leads, added } = mergePendingLeads([], ledger, [
    { title: '某矿智能干选设备中标线索', line: '煤炭智能干选设备', bidStatus: '已中标', source: '聚合站', publishDate: '2026-06-01', url: 'https://agg.example/a' },
    { title: '重复线索', line: '煤炭智能干选设备', bidStatus: '已中标', source: '聚合站', publishDate: '2026-06-01', url: 'https://official.example/1' },
    { title: '超范围旧线索', line: '煤炭智能干选设备', bidStatus: '已中标', source: '聚合站', publishDate: '2025-12-01', url: 'https://agg.example/old' },
  ]);
  assert.equal(added.length, 1);
  assert.equal(leads[0].confidence, '中');
  assert.equal(leads[0].status, '待复核');
});
