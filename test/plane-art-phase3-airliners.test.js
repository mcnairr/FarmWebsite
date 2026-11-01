import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import {
  auditPhase3Airliners,
  PHASE3_AIRLINER_IDS,
} from '../scripts/audit-phase3-airliners.mjs';
import { validatePlaneLibrary } from '../scripts/validate-plane-library.mjs';

test('PG-022 releases exactly 18 approved treatments and 36 directional WebPs', async () => {
  const expectedKeys = new Set(PHASE3_AIRLINER_IDS.flatMap((id) => [`${id}:right`, `${id}:left`]));
  const assets = PLANE_ASSETS.filter(({ key }) => expectedKeys.has(key));
  const files = (await readdir(new URL('../assets/planes/v1/', import.meta.url)))
    .filter((name) => PHASE3_AIRLINER_IDS.some((id) => name === `${id}-right.webp` || name === `${id}-left.webp`));
  assert.equal(new Set(PHASE3_AIRLINER_IDS).size, 18);
  assert.equal(assets.length, 36);
  assert.equal(files.length, 36);
  assert.equal(assets.every(({ approvalStatus }) => approvalStatus === 'approved'), true);
  assert.deepEqual(await validatePlaneLibrary(), []);
});

test('PG-022 audit preserves independent directional production contracts', async () => {
  const report = await auditPhase3Airliners();
  assert.equal(report.treatmentCount, 18);
  assert.equal(report.imageCount, 36);
  assert.deepEqual(report.dimensions, ['960x330']);
  assert.equal(report.generation.approvedPromptRecords, 36);
  assert.equal(report.pairs.every(({ right, left }) => right && left), true);
  assert.equal(report.pairs.every(({ right, left }) => right.sha256 !== left.sha256), true);
  assert.equal(report.pairs.flatMap(({ right, left }) => [right, left])
    .every(({ format, hasAlpha, alpha }) => format === 'webp' && hasAlpha
      && alpha.cornerAlpha.every((value) => value === 0)), true);
});
