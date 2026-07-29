import assert from 'node:assert/strict';
import test from 'node:test';
import config from '../vite.config.mjs';

test('uses the repository path when building for GitHub Pages', () => {
  assert.equal(config.base, '/Xiangsu/');
});
