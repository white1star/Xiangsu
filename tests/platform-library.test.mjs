import assert from 'node:assert/strict';
import test from 'node:test';
import platforms from '../config/platform-library.json' with { type: 'json' };

test('platform library has a complete audit record for every platform', () => {
  const ids = new Set();
  for (const platform of platforms) {
    assert.ok(platform.id && platform.name && platform.entryUrl && platform.category && platform.access && platform.coverage && platform.auditNote, platform.name);
    assert.ok(['anonymous', 'registration_required', 'login_required'].includes(platform.access), `unknown access model: ${platform.id}`);
    assert.equal(ids.has(platform.id), false, `duplicate id: ${platform.id}`);
    ids.add(platform.id);
  }
});

test('platform library covers national, owner procurement, coal provinces, and authentication-only sources', () => {
  const groups = new Set(platforms.map(platform => platform.category));
  for (const group of ['national', 'energy_owner', 'coal_owner', 'province', 'authentication']) assert.ok(groups.has(group), group);
  assert.ok(platforms.filter(platform => platform.access === 'anonymous').length >= 20);
  assert.ok(platforms.filter(platform => platform.access !== 'anonymous').length >= 25);
  assert.ok(platforms.some(platform => platform.access === 'registration_required'));
  assert.ok(platforms.some(platform => platform.id === 'aiqicha'));
  assert.ok(platforms.some(platform => platform.id === 'qianlima'));
  assert.ok(platforms.some(platform => platform.id === 'national-ggzy'));
  assert.ok(platforms.some(platform => platform.id === 'ccteg'));
  assert.ok(platforms.some(platform => platform.id === 'shanxi-ggzy'));
});
