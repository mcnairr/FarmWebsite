import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../api/src/cache.js';
import { fakeClock } from './helpers.js';

test('repeated requests within TTL hit the loader once', async () => {
  const now = fakeClock();
  const cache = new TtlCache({ now });
  let loads = 0;
  const load = () => cache.getOrLoad('k', async () => ++loads, () => 1000);
  assert.equal(await load(), 1);
  assert.equal(await load(), 1);
  now.advance(999);
  assert.equal(await load(), 1);
  now.advance(2);
  assert.equal(await load(), 2);
});

test('concurrent callers share one in-flight load', async () => {
  const cache = new TtlCache();
  let loads = 0;
  const loader = async () => {
    loads++;
    await new Promise((r) => setTimeout(r, 10));
    return 'v';
  };
  const results = await Promise.all([1, 2, 3, 4].map(() => cache.getOrLoad('k', loader, () => 1000)));
  assert.deepEqual(results, ['v', 'v', 'v', 'v']);
  assert.equal(loads, 1);
});

test('rejected loads are not cached', async () => {
  const cache = new TtlCache();
  let attempts = 0;
  const loader = async () => {
    attempts++;
    if (attempts === 1) throw new Error('boom');
    return 'ok';
  };
  await assert.rejects(cache.getOrLoad('k', loader, () => 1000));
  assert.equal(await cache.getOrLoad('k', loader, () => 1000), 'ok');
});

test('TTL can depend on the value', async () => {
  const now = fakeClock();
  const cache = new TtlCache({ now });
  await cache.getOrLoad('hit', async () => ({ found: true }), (v) => (v.found ? 10_000 : 100));
  await cache.getOrLoad('miss', async () => ({ found: false }), (v) => (v.found ? 10_000 : 100));
  now.advance(500);
  assert.equal(cache.has('hit'), true);
  assert.equal(cache.has('miss'), false);
});

test('evicts oldest entries beyond maxEntries', () => {
  const cache = new TtlCache({ maxEntries: 2 });
  cache.set('a', 1, 1000);
  cache.set('b', 2, 1000);
  cache.set('c', 3, 1000);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), 3);
});
