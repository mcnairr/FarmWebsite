import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PROCESSING_SETTINGS } from './process-plane-art.mjs';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function saturation(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function alphaBounds(data, width, height) {
  let top = height;
  let bottom = -1;
  for (let offset = 3, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    if (data[offset] === 0) continue;
    const y = Math.floor(pixel / width);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  if (bottom < 0) throw new Error('Source contains no visible aircraft pixels.');
  return { top, bottom };
}

function median(values) {
  const sorted = values.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Use a generated clean-lighting reference only as a low-frequency luminance
 * guide. Original RGB detail, geometry, and alpha remain the production source.
 */
export async function repairPlaneLighting({ sourcePath, referencePath, outputPath }) {
  if (!sourcePath || !referencePath || !outputPath) throw new Error('sourcePath, referencePath, and outputPath are required.');
  const source = sharp(resolve(sourcePath), { failOn: 'warning' });
  const metadata = await source.metadata();
  const { width, height } = PROCESSING_SETTINGS.canvas;
  if (metadata.width !== width || metadata.height !== height || !metadata.hasAlpha) {
    throw new Error(`Source must be the transparent ${width}x${height} production asset.`);
  }
  const sourceRaw = await source.ensureAlpha().toColourspace('srgb').raw().toBuffer();
  const referenceRaw = await sharp(resolve(referencePath), { failOn: 'warning' })
    .resize(width, height, { fit: 'fill' }).ensureAlpha().toColourspace('srgb').raw().toBuffer();
  const output = Buffer.from(sourceRaw);
  const bounds = alphaBounds(sourceRaw, width, height);
  const visibleHeight = Math.max(1, bounds.bottom - bounds.top);
  const sourceSamples = [];
  const referenceSamples = [];
  for (let offset = 0, pixel = 0; offset < sourceRaw.length; offset += 4, pixel += 1) {
    const y = Math.floor(pixel / width);
    if ((y - bounds.top) / visibleHeight > 0.6) continue;
    for (const [data, samples] of [[sourceRaw, sourceSamples], [referenceRaw, referenceSamples]]) {
      if (data[offset + 3] < 128) continue;
      const r = data[offset] / 255;
      const g = data[offset + 1] / 255;
      const b = data[offset + 2] / 255;
      if (saturation(r, g, b) > 0.28) continue;
      samples.push((0.2126 * data[offset]) + (0.7152 * data[offset + 1]) + (0.0722 * data[offset + 2]));
    }
  }
  if (!sourceSamples.length || !referenceSamples.length) throw new Error('Could not measure neutral upper-surface lighting.');
  const sourceMedian = median(sourceSamples);
  const referenceMedian = median(referenceSamples);
  const correctionStrength = clamp((referenceMedian - sourceMedian) / 255, 0.08, 0.18);
  let changedPixels = 0;
  let maximumLift = 0;

  for (let offset = 0, pixel = 0; offset < sourceRaw.length; offset += 4, pixel += 1) {
    const alpha = sourceRaw[offset + 3];
    if (alpha < 128) continue;
    const r = sourceRaw[offset] / 255;
    const g = sourceRaw[offset + 1] / 255;
    const b = sourceRaw[offset + 2] / 255;
    const neutralWeight = clamp((0.28 - saturation(r, g, b)) / 0.18);
    if (neutralWeight === 0) continue;
    const y = Math.floor(pixel / width);
    const verticalPosition = (y - bounds.top) / visibleHeight;
    const upperSurfaceWeight = clamp((0.78 - verticalPosition) / 0.35);
    if (upperSurfaceWeight === 0) continue;
    const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    const lift = (1 - luminance) * correctionStrength * neutralWeight * upperSurfaceWeight;
    if (lift < 0.004) continue;
    output[offset] = Math.round(clamp(r + lift) * 255);
    output[offset + 1] = Math.round(clamp(g + lift) * 255);
    output[offset + 2] = Math.round(clamp(b + lift) * 255);
    changedPixels += 1;
    maximumLift = Math.max(maximumLift, lift);
  }

  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await sharp(output, { raw: { width, height, channels: 4 } }).png().toFile(resolve(outputPath));
  return {
    width, height, changedPixels,
    sourceUpperMedian: Math.round(sourceMedian), referenceUpperMedian: Math.round(referenceMedian),
    correctionStrength: Number(correctionStrength.toFixed(4)),
    maximumLift: Number(maximumLift.toFixed(4)), alphaPreserved: true,
  };
}

function parseArguments(argv) {
  const options = {};
  const names = new Map([['--source', 'sourcePath'], ['--reference', 'referencePath'], ['--output', 'outputPath']]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = names.get(argv[index]);
    if (!key || index + 1 >= argv.length) throw new Error(`Unknown or incomplete argument '${argv[index]}'.`);
    options[key] = argv[index + 1];
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await repairPlaneLighting(parseArguments(process.argv.slice(2))), null, 2));
}
