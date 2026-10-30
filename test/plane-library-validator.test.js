import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import { resolveAuthoredValidationAsset, validatePlaneLibrary } from '../scripts/validate-plane-library.mjs';

const root = process.cwd();

function promptFor(asset, overrides = {}) {
  return {
    key: asset.promptRecordKey,
    artworkId: asset.artworkId,
    direction: asset.direction,
    category: asset.category,
    anatomy: { mainRotorCount: 0, tailRotorCount: 0 },
    modelId: asset.generationModel,
    status: 'planned',
    output: { manifestKey: asset.key, url: asset.url, sha256: null },
    ...overrides,
  };
}

test('PG-006 repository library passes integrity and public safety validation', async () => {
  assert.deepEqual(await validatePlaneLibrary(), []);
});

test('PG-006 hostile values can resolve only to authored generic URLs', () => {
  const values = ['../../secret', '/assets/planes/v1/evil.webp', 'AAL<script>', '__proto__', 'B738?x=../../evil', '💥'];
  const authored = new Set(PLANE_ASSETS.map(({ url }) => url));
  for (const value of values) {
    const asset = resolveAuthoredValidationAsset({ icaoType: value, callsign: value, airlineName: value }, PLANE_ASSETS);
    assert.ok(asset);
    assert.match(asset.artworkId, /^generic-/);
    assert.ok(authored.has(asset.url));
    assert.equal(asset.url.includes(value), false);
  }
});

test('PG-006 detects conflicting mappings, category contradictions, and fallback cycles', async () => {
  const base = PLANE_ASSETS.map((asset) => ({ ...asset, applicableIcaoTypes: [...asset.applicableIcaoTypes], allowedCallsignPrefixes: [...asset.allowedCallsignPrefixes] }));
  const extra = {
    ...base[0], key: 'bad-helicopter:right', artworkId: 'bad-helicopter',
    category: 'helicopter', url: '/assets/planes/v1/bad-helicopter-right.webp',
    promptRecordKey: 'bad-helicopter:right:v1', fallbackId: 'bad-helicopter',
  };
  const prompts = { records: [...base.map((asset) => promptFor(asset)), promptFor(extra, {
    category: 'helicopter', anatomy: { mainRotorCount: 1, tailRotorCount: 1 },
  })] };
  const errors = await validatePlaneLibrary({ assets: [...base, extra], prompts, publicFiles: [] });
  assert.ok(errors.some((error) => error.includes('conflicting exact mapping AAL:A319')));
  assert.ok(errors.some((error) => error.includes('helicopter artwork to non-helicopter ICAO type A319')));
  assert.ok(errors.some((error) => error.includes('fallback cycle starts at bad-helicopter:right')));
});

test('PG-006 approved records require a complete pair and image', async (t) => {
  const fixture = await mkdtemp(join(root, '.generated', 'validator-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const asset = { ...PLANE_ASSETS[0], approvalStatus: 'approved' };
  const errors = await validatePlaneLibrary({
    root: fixture,
    assets: [asset],
    prompts: { records: [promptFor(asset, { status: 'approved' })] },
    publicFiles: [],
  });
  assert.ok(errors.some((error) => error.includes('without exactly one approved left and one approved right')));
  assert.ok(errors.some((error) => error.includes('approved image is missing')));
});

test('PG-006 accepts a complete approved WebP pair with matching hashes', async (t) => {
  const fixture = await mkdtemp(join(root, '.generated', 'validator-approved-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const directory = join(fixture, 'assets', 'planes', 'v1');
  await mkdir(directory, { recursive: true });
  const bytes = await sharp({ create: { width: 960, height: 330, channels: 4, background: { r: 20, g: 30, b: 40, alpha: 0.5 } } }).webp().toBuffer();
  const hash = createHash('sha256').update(bytes).digest('hex');
  const assets = PLANE_ASSETS
    .filter(({ artworkId }) => ['aal-narrowbody', 'generic-narrowbody'].includes(artworkId))
    .map((asset) => ({
    ...asset, approvalStatus: asset.artworkId === 'aal-narrowbody' ? 'approved' : 'planned',
  }));
  for (const asset of assets.filter(({ approvalStatus }) => approvalStatus === 'approved')) {
    await writeFile(join(directory, `${asset.artworkId}-${asset.direction}.webp`), bytes);
  }
  const prompts = { records: assets.map((asset) => promptFor(asset, {
    status: asset.approvalStatus === 'approved' ? 'approved' : 'planned',
    output: { manifestKey: asset.key, url: asset.url, sha256: asset.approvalStatus === 'approved' ? hash : null },
  })) };
  assert.deepEqual(await validatePlaneLibrary({ root: fixture, assets, prompts, publicFiles: [] }), []);
});

test('PG-006 scans public sources for secrets and Vertex runtime dependencies', async () => {
  const prompts = { records: PLANE_ASSETS.map((asset) => promptFor(asset)) };
  const errors = await validatePlaneLibrary({
    assets: PLANE_ASSETS,
    prompts,
    publicFiles: [{ path: 'assets/unsafe.js', source: "import { VertexAI } from '@google-cloud/vertexai'; const key = 'AKIA1234567890ABCDEF';" }],
  });
  assert.ok(errors.some((error) => error.includes('AWS access key')));
  assert.ok(errors.some((error) => error.includes('Vertex runtime/SDK reference')));
});
