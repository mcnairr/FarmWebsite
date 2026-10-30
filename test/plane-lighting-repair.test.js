import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { repairPlaneLighting } from '../scripts/repair-plane-lighting.mjs';

test('PG-011 lighting repair preserves production geometry and alpha exactly', async (t) => {
  const fixture = await mkdtemp(join(process.cwd(), '.generated', 'lighting-repair-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const sourcePath = join(process.cwd(), 'assets', 'planes', 'v1', 'aal-narrowbody-right.webp');
  const referencePath = join(fixture, 'reference.png');
  const outputPath = join(fixture, 'repaired.png');
  await sharp(sourcePath).modulate({ brightness: 1.2 }).png().toFile(referencePath);
  const result = await repairPlaneLighting({ sourcePath, referencePath, outputPath });
  const source = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = await sharp(await readFile(outputPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([output.info.width, output.info.height], [960, 330]);
  assert.ok(result.changedPixels > 0);
  for (let offset = 3; offset < source.data.length; offset += 4) assert.equal(output.data[offset], source.data[offset]);
});
