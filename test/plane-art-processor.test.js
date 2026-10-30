import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { PROCESSING_SETTINGS, processPlaneArt } from '../scripts/process-plane-art.mjs';

const root = process.cwd();
const output = join(root, 'assets', 'planes', 'v1', 'aal-narrowbody-right.webp');
const generated = join(root, '.generated', 'plane-art');
const report = join(generated, 'processed', 'aal-narrowbody-right.json');
const sourceImage = join(root, 'design', 'plane-art', 'proofs', 'vertex', 'american-branded.png');
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

test('PG-005 processor is deterministic and enforces the production checks', async (t) => {
  await assert.rejects(stat(output), { code: 'ENOENT' }, 'test target must not replace a real production asset');
  await mkdir(generated, { recursive: true });
  const fixture = await mkdtemp(join(generated, 'processor-test-'));
  const metadataPath = join(fixture, 'metadata.json');
  const proofPath = join(fixture, 'proof.png');
  const sourceBytes = await readFile(sourceImage);
  await writeFile(metadataPath, `${JSON.stringify({
    artworkId: 'aal-narrowbody',
    direction: 'right',
    requestKey: 'deterministic-fixture',
    promptRevision: 'aal-narrowbody:right:v1',
    candidates: [{ file: 'american-branded.png', sha256: digest(sourceBytes) }],
  }, null, 2)}\n`);
  t.after(async () => {
    await rm(output, { force: true });
    await rm(report, { force: true });
    await rm(fixture, { recursive: true, force: true });
  });

  const options = {
    artworkId: 'aal-narrowbody', direction: 'right', inputPath: sourceImage,
    sourceMetadataPath: metadataPath, proofPath,
  };
  const first = await processPlaneArt(options);
  const firstBytes = await readFile(output);
  const firstReport = JSON.stringify(first.report);
  assert.equal(first.report.output.sha256, digest(firstBytes));
  assert.equal(first.report.source.requestKey, 'deterministic-fixture');
  assert.equal(first.report.processing.mirrorOrFlip, false);
  assert.ok(Object.values(first.report.checks).every((value) => typeof value !== 'boolean' || value));
  assert.deepEqual(await sharp(proofPath).metadata().then(({ width, height }) => [width, height]), [960, 840]);

  await assert.rejects(processPlaneArt(options), /explicit replacement workflow/);
  const replacement = await processPlaneArt({
    ...options,
    replaceApproved: true,
    replacementNote: '2026-10-29 test-only explicit replacement approval',
  });
  assert.equal(replacement.report.replacement.previousSha256, first.report.output.sha256);
  assert.deepEqual(await readFile(output), firstBytes);
  await rm(output);
  await rm(report);
  const second = await processPlaneArt(options);
  assert.deepEqual(await readFile(output), firstBytes);
  assert.equal(JSON.stringify(second.report), firstReport);
});

test('PG-005 rejects ambiguous direction and mismatched directional provenance', async (t) => {
  await mkdir(generated, { recursive: true });
  const fixture = await mkdtemp(join(generated, 'processor-direction-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await assert.rejects(processPlaneArt({ artworkId: 'aal-narrowbody', direction: 'both', inputPath: sourceImage }), /exactly 'left' or 'right'/);
  const metadataPath = join(fixture, 'metadata.json');
  await writeFile(metadataPath, JSON.stringify({ artworkId: 'aal-narrowbody', direction: 'left', candidates: [] }));
  await assert.rejects(processPlaneArt({
    artworkId: 'aal-narrowbody', direction: 'right', inputPath: sourceImage, sourceMetadataPath: metadataPath,
  }), /identifies 'aal-narrowbody:left'/);
});

test('PG-005 settings remain identical to the approved PG-001 contract', () => {
  assert.deepEqual(PROCESSING_SETTINGS.canvas, { width: 960, height: 330 });
  assert.deepEqual(PROCESSING_SETTINGS.contentBox, { width: 888, height: 270 });
  assert.deepEqual(PROCESSING_SETTINGS.webp, { quality: 90, alphaQuality: 100, smartSubsample: true, effort: 4 });
  assert.deepEqual(PROCESSING_SETTINGS.byteRange, { min: 40_000, max: 110_000 });
  assert.equal(PROCESSING_SETTINGS.baseline, 290);
  assert.equal(PROCESSING_SETTINGS.method, 'edge-connected-white-matte');
});
