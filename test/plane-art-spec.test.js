import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

const root = process.cwd();

function idsBetween(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  const end = markdown.indexOf(endHeading, start + startHeading.length);
  assert.notEqual(start, -1, `missing section ${startHeading}`);
  assert.notEqual(end, -1, `missing section terminator ${endHeading}`);
  return [...markdown.slice(start, end).matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);
}

test('PG-001 phase allocation contains 16, 24, and 34 unique additions', async () => {
  const backlog = await readFile(join(root, 'design', 'plane-graphics-issues.md'), 'utf8');
  const phase1 = idsBetween(backlog, '### Phase 1 — 16 treatments', '### Phase 2 additions');
  const phase2 = idsBetween(backlog, '### Phase 2 additions', '### Phase 3 additions');
  const phase3 = idsBetween(backlog, '### Phase 3 additions', '> Count note:');
  assert.deepEqual([phase1.length, phase2.length, phase3.length], [16, 24, 34]);
  assert.equal(new Set([...phase1, ...phase2, ...phase3]).size, 74);
});

test('PG-001 approved matrix has 74 unique IDs with names and shapes', async () => {
  const plan = await readFile(join(root, 'design', 'plane-graphics-plan2.md'), 'utf8');
  const matrix = plan.slice(plan.indexOf('## Planned artwork matrix'), plan.indexOf('## ICAO type and callsign resolution'));
  const rows = [...matrix.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)]
    .map((match) => ({ number: Number(match[1]), id: match[2], name: match[3].trim(), shape: match[4].trim() }));
  assert.equal(rows.length, 74);
  assert.equal(new Set(rows.map(({ id }) => id)).size, 74);
  assert.deepEqual(rows.map(({ number }) => number), Array.from({ length: 74 }, (_, index) => index + 1));
  assert.ok(rows.every(({ name, shape }) => name.length > 0 && shape.length > 0));
  assert.deepEqual([
    rows.filter(({ number }) => number <= 47).length,
    rows.filter(({ number }) => number >= 48 && number <= 62).length,
    rows.filter(({ number }) => number >= 63).length,
  ], [47, 15, 12]);
});

test('PG-001 reference WebPs satisfy the approved output contract', async () => {
  const report = JSON.parse(await readFile(join(root, 'design', 'plane-art', 'reference', 'measurements.json'), 'utf8'));
  assert.deepEqual(report.selected, {
    method: 'edge-connected-white-matte', quality: 90, width: 960, height: 330,
    paddingX: 36, top: 20, baseline: 290,
  });
  const selected = report.measurements.filter(({ method, quality }) => method === report.selected.method && quality === report.selected.quality);
  assert.equal(selected.length, 4);
  for (const measurement of selected) {
    assert.ok(measurement.bytes >= 40_000 && measurement.bytes <= 110_000, `${measurement.source} is outside the byte target`);
    const filename = `${measurement.source.replace(/\.png$/, '')}-${measurement.method}-q${measurement.quality}.webp`;
    const path = join(root, 'design', 'plane-art', 'reference', filename);
    assert.equal((await stat(path)).size, measurement.bytes);
    const metadata = await sharp(path).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 960);
    assert.equal(metadata.height, 330);
    assert.equal(metadata.hasAlpha, true);
  }
});
