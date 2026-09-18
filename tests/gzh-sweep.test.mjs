import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueryMatrix, pickQueries } from '../scripts/gzh_sweep.mjs';

test('buildQueryMatrix covers 14 vendors + 4 devices with 22 unique queries', () => {
  const matrix = buildQueryMatrix();
  assert.equal(matrix.length, 22);
  assert.ok(matrix.includes('天津美腾科技 中标'));
  assert.ok(matrix.includes('XRT 智能分选 签约'));
  assert.equal(new Set(matrix).size, matrix.length);
});

test('pickQueries skips recent queries, respects daily cap and prefers longest-idle', () => {
  const matrix = buildQueryMatrix();
  const now = Date.now();
  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });

  const neverRun = { dailyDate: today, dailyCount: 0, queries: {} };
  const pickedNever = pickQueries(matrix, neverRun, now, 5, 12);
  assert.equal(pickedNever.length, 5, '从未跑过时应取满本次上限');

  const allIdle = { dailyDate: today, dailyCount: 0, queries: {} };
  for (const q of matrix) allIdle.queries[q] = { lastRunAt: new Date(now - 25 * 3600 * 1000).toISOString(), runs: 1, added: 0 };
  allIdle.queries['唐山神州机械 中标'].lastRunAt = new Date(now - 30 * 3600 * 1000).toISOString();
  allIdle.queries['天津美腾科技 中标'].lastRunAt = new Date(now - 3600 * 1000).toISOString();
  const pickedIdle = pickQueries(matrix, allIdle, now, 5, 12);
  assert.equal(pickedIdle[0], '唐山神州机械 中标', '最久未跑（30h）应排第一');
  assert.ok(!pickedIdle.includes('天津美腾科技 中标'), '1 小时前跑过的应跳过');

  assert.equal(pickQueries(matrix, { dailyDate: today, dailyCount: 12, queries: {} }, now, 5, 12).length, 0, '每日配额用满应返回空');
});
