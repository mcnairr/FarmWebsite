import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPhase1PlaneArt, byteDistribution, PHASE1_TREATMENT_IDS } from '../scripts/audit-phase1-plane-art.mjs';

test('PG-011 Phase 1 audit covers the frozen 16-pair production batch', async () => {
  const report = await auditPhase1PlaneArt();
  assert.equal(PHASE1_TREATMENT_IDS.length, 16);
  assert.equal(new Set(PHASE1_TREATMENT_IDS).size, 16);
  assert.equal(report.treatmentCount, 16);
  assert.equal(report.imageCount, 32);
  assert.deepEqual(report.generation, {
    providers: ['Google Cloud Vertex AI'],
    modelIds: ['gemini-3.1-flash-image'],
    promptRevisions: ['v1'],
    generationAmendments: ['pg011-lighting-1'],
    effectiveFuturePromptRevisions: ['v1+pg011-lighting-1'],
    approvedPromptRecords: 32,
    repairedPromptRecords: 10,
    lightingRepairAssets: [
      'aal-narrowbody:right', 'american-eagle-regional:right', 'dal-narrowbody:left',
      'dal-widebody:left', 'dal-widebody:right', 'fdx-widebody:left',
      'generic-narrowbody:left', 'generic-narrowbody:right',
      'generic-widebody:left', 'generic-widebody:right',
    ],
  });
  assert.deepEqual(report.dimensions, ['960x330']);
  assert.equal(report.pairs.every(({ right, left }) => right && left), true);
  assert.equal(report.pairs.flatMap(({ right, left }) => [right, left]).every(({ format, hasAlpha }) => format === 'webp' && hasAlpha), true);
});

test('PG-011 Phase 1 alpha and byte measurements match the frozen gate', async () => {
  const report = await auditPhase1PlaneArt();
  assert.equal(report.alphaSummary.imagesWithAlpha, 32);
  assert.equal(report.alphaSummary.imagesWithTransparentCorners, 32);
  assert.deepEqual(report.alphaSummary.baselineValues, [289]);
  assert.ok(report.alphaSummary.minimumPadding.left >= 36);
  assert.ok(report.alphaSummary.minimumPadding.right >= 36);
  assert.ok(report.alphaSummary.minimumPadding.top >= 20);
  assert.ok(report.alphaSummary.minimumPadding.belowBaseline >= 40);
  assert.equal(report.targetExceptions.every(({ reason }) => reason === 'below'), true);
  assert.equal(report.targetExceptions.some(({ bytes }) => bytes >= 40_000 || bytes > 110_000), false);
});

test('PG-011 byte distribution uses interpolated quartiles and exact totals', () => {
  assert.deepEqual(byteDistribution([10, 20, 30, 40]), {
    count: 4, min: 10, p25: 18, median: 25, mean: 25, p75: 33, max: 40, total: 100,
  });
});
