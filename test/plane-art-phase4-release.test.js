import assert from 'node:assert/strict';
import test from 'node:test';

import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import { auditPhase4PlaneArt, PHASE4_IDS } from '../scripts/audit-phase4-plane-art.mjs';

test('PG-027 releases two observed silhouettes as independent approved pairs', async () => {
  const report = await auditPhase4PlaneArt();
  assert.deepEqual(PHASE4_IDS, ['cirrus-vision-jet', 'citation-x']);
  assert.equal(report.treatmentCount, 2);
  assert.equal(report.imageCount, 4);
  assert.equal(report.generation.approvedPromptRecords, 4);
  assert.deepEqual(report.generation.providers, ['Google Cloud Vertex AI']);
  assert.deepEqual(report.generation.modelIds, ['gemini-3.1-flash-image']);
  assert.equal(report.alphaSummary.imagesWithAlpha, 4);
  assert.equal(report.alphaSummary.imagesWithTransparentCorners, 4);
  assert.deepEqual(report.alphaSummary.baselineValues, [289]);
  assert.ok(report.pairs.every(({ right, left }) => right.sha256 !== left.sha256));
  assert.ok(report.targetExceptions.every(({ reason }) => reason === 'below'));

  for (const artworkId of PHASE4_IDS) {
    const pair = PLANE_ASSETS.filter((asset) => asset.artworkId === artworkId);
    assert.deepEqual(pair.map(({ direction }) => direction).sort(), ['left', 'right']);
    assert.ok(pair.every(({ approvalStatus }) => approvalStatus === 'approved'));
  }
});
