import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import { PHASE1_TREATMENT_IDS } from '../scripts/audit-phase1-plane-art.mjs';
import { validatePlaneLibrary } from '../scripts/validate-plane-library.mjs';

test('PG-016 releases exactly 16 approved pairs and 32 production WebPs', async () => {
  const phase1 = PLANE_ASSETS.filter(({ artworkId }) => PHASE1_TREATMENT_IDS.includes(artworkId));
  const files = (await readdir(new URL('../assets/planes/v1/', import.meta.url)))
    .filter((name) => name.endsWith('.webp'));
  const phase1Files = new Set(phase1.map(({ url }) => url.split('/').at(-1)));

  assert.equal(new Set(phase1.map(({ artworkId }) => artworkId)).size, 16);
  assert.equal(phase1.length, 32);
  assert.equal(phase1.every(({ approvalStatus }) => approvalStatus === 'approved'), true);
  assert.equal(files.filter((name) => phase1Files.has(name)).length, 32);
  assert.deepEqual(await validatePlaneLibrary(), []);
});

test('PG-016 public runtime has no generation-time package dependency', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const runtimePackages = Object.keys(packageJson.dependencies ?? {});
  const generationPackages = /(?:vertex|aiplatform|google-auth|google-cloud)/i;

  assert.deepEqual(runtimePackages, []);
  assert.equal(Object.keys(packageJson.devDependencies ?? {}).some((name) => generationPackages.test(name)), false);
});
