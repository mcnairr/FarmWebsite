import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import { auditPhase3Specialty, PHASE3_SPECIALTY_IDS } from '../scripts/audit-phase3-specialty.mjs';
import { validatePlaneLibrary } from '../scripts/validate-plane-library.mjs';

test('PG-024 releases exactly 7 approved treatments and 14 directional WebPs', async () => {
  const expected = new Set(PHASE3_SPECIALTY_IDS.flatMap((id) => [`${id}:right`, `${id}:left`]));
  const assets = PLANE_ASSETS.filter(({ key }) => expected.has(key));
  const files = (await readdir(new URL('../assets/planes/v1/', import.meta.url)))
    .filter((name) => PHASE3_SPECIALTY_IDS.some((id) => name === `${id}-right.webp` || name === `${id}-left.webp`));
  assert.equal(assets.length, 14);
  assert.equal(files.length, 14);
  assert.equal(assets.every(({ approvalStatus }) => approvalStatus === 'approved'), true);
  assert.deepEqual(await validatePlaneLibrary(), []);
});

test('PG-024 audit preserves independent direction, anatomy, and identity contracts', async () => {
  const report = await auditPhase3Specialty();
  assert.equal(report.treatmentCount, 7);
  assert.equal(report.imageCount, 14);
  assert.deepEqual(report.dimensions, ['960x330']);
  assert.equal(report.generation.approvedPromptRecords, 14);
  assert.equal(report.pairs.every(({ right, left }) => right && left && right.sha256 !== left.sha256), true);
  assert.equal(report.pairs.flatMap(({ right, left }) => [right, left])
    .every(({ format, hasAlpha, alpha }) => format === 'webp' && hasAlpha
      && alpha.cornerAlpha.every((value) => value === 0)), true);
});
