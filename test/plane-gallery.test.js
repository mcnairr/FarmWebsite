import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';

const root = process.cwd();
const gallery = await readFile(join(root, 'design', 'plane-gallery.html'), 'utf8');

test('PG-007 gallery is a development-only direct view of production records', async () => {
  assert.match(gallery, /import \{ PLANE_ASSETS \} from '\/assets\/planes\/v1\/manifest\.js'/);
  assert.match(gallery, /fetch\('\/design\/plane-art\/prompts\.json'\)/);
  assert.match(gallery, /noindex, nofollow/);
  assert.match(gallery, /Development only/i);
  const homepage = await readFile(join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(homepage, /plane-gallery/i);
  assert.ok(PLANE_ASSETS.length > 0, 'manifest must contain records for the gallery');
});

test('PG-007 gallery supplies every required category filter', () => {
  for (const filter of ['airline', 'cargo', 'general-aviation', 'crop-duster', 'helicopter', 'military']) {
    assert.match(gallery, new RegExp(`data-filter="${filter}"`));
  }
  assert.match(gallery, /airline: \['scheduled-passenger'\]/);
  assert.match(gallery, /'general-aviation': \['business', 'general-aviation', 'turboprop'\]/);
});

test('PG-007 gallery renders paired directions and the full review matrix', () => {
  assert.match(gallery, /directionCard\(treatment, 'right'\), directionCard\(treatment, 'left'\)/);
  assert.match(gallery, /\['climb', '-12deg'\], \['level', '0deg'\], \['descent', '12deg'\]/);
  assert.match(gallery, /for \(const background of \['sky', 'checker'\]\)/);
  assert.match(gallery, /for \(const size of \['hero', 'blip'\]\)/);
  assert.match(gallery, /width: min\(100%, 272px\)/);
  assert.match(gallery, /width: 46px/);
  assert.match(gallery, /MISSING ASSET/);
});

test('PG-007 gallery includes metadata, rejection guidance, and draft-note export', () => {
  for (const label of ['Filename', 'Bytes', 'Dimensions', 'Mapping', 'Model', 'Prompt key', 'Approval']) {
    assert.match(gallery, new RegExp(`'${label}'`));
  }
  for (const rejection of ['Wrong direction', 'Malformed wings', 'Engine or rotor count', 'opaque corners', 'Watermark', 'ugly blip silhouette']) {
    assert.match(gallery, new RegExp(rejection, 'i'));
  }
  assert.match(gallery, /localStorage\.setItem/);
  assert.match(gallery, /plane-gallery-approval-notes\.json/);
});
