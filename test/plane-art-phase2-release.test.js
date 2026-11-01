import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import {
  auditPhase2PlaneArt,
  PHASE2_ADDITION_IDS,
  PHASE2_TREATMENT_IDS,
} from '../scripts/audit-phase2-plane-art.mjs';
import { validatePlaneLibrary } from '../scripts/validate-plane-library.mjs';

test('PG-021 releases exactly 40 approved treatments and 80 directional WebPs', async () => {
  const files = (await readdir(new URL('../assets/planes/v1/', import.meta.url)))
    .filter((name) => name.endsWith('.webp'));
  assert.equal(PHASE2_ADDITION_IDS.length, 24);
  assert.equal(new Set(PHASE2_TREATMENT_IDS).size, 40);
  assert.equal(PLANE_ASSETS.length, 80);
  assert.equal(files.length, 80);
  assert.equal(PLANE_ASSETS.every(({ approvalStatus }) => approvalStatus === 'approved'), true);
  assert.deepEqual(await validatePlaneLibrary(), []);
});

test('PG-021 Phase 2 audit covers every pair and preserves the production contract', async () => {
  const report = await auditPhase2PlaneArt();
  assert.equal(report.phase, 'Phase 2');
  assert.equal(report.treatmentCount, 40);
  assert.equal(report.imageCount, 80);
  assert.deepEqual(report.dimensions, ['960x330']);
  assert.equal(report.generation.approvedPromptRecords, 80);
  assert.equal(report.pairs.every(({ right, left }) => right && left), true);
  assert.equal(report.pairs.flatMap(({ right, left }) => [right, left])
    .every(({ format, hasAlpha, alpha }) => format === 'webp' && hasAlpha
      && alpha.cornerAlpha.every((value) => value === 0)), true);
});
