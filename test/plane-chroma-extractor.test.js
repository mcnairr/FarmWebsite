import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { extractPlaneChroma } from '../scripts/extract-plane-chroma.mjs';

test('PG-018 chroma extraction removes edge-connected magenta and preserves enclosed paint', async (t) => {
  const directory = await mkdtemp(join(process.cwd(), '.generated', 'chroma-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'input.png');
  const output = join(directory, 'output.png');
  await sharp({ create: { width: 40, height: 24, channels: 3, background: '#ff00ff' } })
    .composite([{ input: Buffer.from('<svg width="40" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="6" width="24" height="12" rx="3" fill="white"/><rect x="16" y="9" width="8" height="6" fill="#d000d0"/></svg>') }])
    .png().toFile(input);
  await extractPlaneChroma({ inputPath: input, outputPath: output });
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0);
  assert.equal(alpha(20, 12), 255);
  assert.equal(alpha(10, 12), 255);
});

test('PG-010 global chroma extraction removes enclosed key pixels when the subject palette excludes magenta', async (t) => {
  const directory = await mkdtemp(join(process.cwd(), '.generated', 'chroma-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'input.png');
  const output = join(directory, 'output.png');
  await sharp({ create: { width: 40, height: 24, channels: 3, background: '#ff00ff' } })
    .composite([{ input: Buffer.from('<svg width="40" height="24" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="6" width="24" height="12" rx="3" fill="white"/><rect x="16" y="9" width="8" height="6" fill="#d000d0"/></svg>') }])
    .png().toFile(input);
  await extractPlaneChroma({ inputPath: input, outputPath: output, scope: 'global' });
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0);
  assert.ok(alpha(20, 12) < 128);
  assert.equal(alpha(10, 12), 255);
});
