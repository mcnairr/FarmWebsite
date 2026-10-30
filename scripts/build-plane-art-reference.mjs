import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const inputDirectory = join(root, 'design', 'plane-art', 'proofs', 'vertex');
const outputDirectory = join(root, 'design', 'plane-art', 'reference');
const sourceNames = [
  'american-branded',
  'american-inspired-no-logo',
  'southwest-branded',
  'southwest-inspired-no-logo',
];
const methods = ['global-white-key', 'edge-connected-white-matte'];
const qualities = [78, 84, 90];
const canvas = { width: 960, height: 330, paddingX: 36, top: 20, baseline: 290 };

function whiteDistance(r, g, b) {
  return Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
}

function unmatte(value, alpha) {
  if (alpha <= 0) return 0;
  const a = alpha / 255;
  return Math.max(0, Math.min(255, Math.round((value - 255 * (1 - a)) / a)));
}

function globalWhiteKey(data, width, height) {
  const output = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 3;
    const distance = whiteDistance(data[offset], data[offset + 1], data[offset + 2]);
    const alpha = Math.max(0, Math.min(255, Math.round(((distance - 7) / 43) * 255)));
    output[pixel * 4] = unmatte(data[offset], alpha);
    output[pixel * 4 + 1] = unmatte(data[offset + 1], alpha);
    output[pixel * 4 + 2] = unmatte(data[offset + 2], alpha);
    output[pixel * 4 + 3] = alpha;
  }
  return output;
}

function edgeConnectedWhiteMatte(data, width, height) {
  const pixelCount = width * height;
  const connected = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const add = (pixel) => {
    if (connected[pixel]) return;
    const offset = pixel * 3;
    if (whiteDistance(data[offset], data[offset + 1], data[offset + 2]) > 72) return;
    connected[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x += 1) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) add(pixel - 1);
    if (x + 1 < width) add(pixel + 1);
    if (y > 0) add(pixel - width);
    if (y + 1 < height) add(pixel + width);
  }

  const output = Buffer.alloc(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const inputOffset = pixel * 3;
    const outputOffset = pixel * 4;
    const distance = whiteDistance(data[inputOffset], data[inputOffset + 1], data[inputOffset + 2]);
    const alpha = connected[pixel]
      ? Math.max(0, Math.min(255, Math.round(((distance - 7) / 65) * 255)))
      : 255;
    output[outputOffset] = unmatte(data[inputOffset], alpha);
    output[outputOffset + 1] = unmatte(data[inputOffset + 1], alpha);
    output[outputOffset + 2] = unmatte(data[inputOffset + 2], alpha);
    output[outputOffset + 3] = alpha;
  }
  return output;
}

async function removeBackground(inputPath, method) {
  const { data, info } = await sharp(inputPath).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const rgba = method === 'global-white-key'
    ? globalWhiteKey(data, info.width, info.height)
    : edgeConnectedWhiteMatte(data, info.width, info.height);
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function normalize(inputPath, method) {
  const backgroundRemoved = await removeBackground(inputPath, method);
  const trimmed = await backgroundRemoved
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .png()
    .toBuffer();
  const resized = await sharp(trimmed)
    .resize({
      width: canvas.width - canvas.paddingX * 2,
      height: canvas.baseline - canvas.top,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((canvas.width - resized.info.width) / 2);
  const top = canvas.baseline - resized.info.height;
  const normalized = await sharp({
    create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: resized.data, left, top }]).png().toBuffer();
  return { normalized, bounds: { left, top, width: resized.info.width, height: resized.info.height } };
}

function checkerSvg(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="24" height="24" patternUnits="userSpaceOnUse"><path fill="#fff" d="M0 0h24v24H0z"/><path fill="#d7dde5" d="M0 0h12v12H0zM12 12h12v12H12z"/></pattern></defs><path fill="url(#c)" d="M0 0h${width}v${height}H0z"/></svg>`);
}

function labelSvg(width, height, labels) {
  const text = labels.map(({ x, y, value, size = 30 }) => `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" fill="white" stroke="#071b39" stroke-width="4" paint-order="stroke">${value}</text>`).join('');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${text}</svg>`);
}

async function buildComparisonSheet(globalImage, edgeImage) {
  const width = 1920;
  const height = 1080;
  const sky = await sharp(join(root, 'Oats.jpg')).resize(width, height, { fit: 'cover', position: 'top' }).toBuffer();
  const heroGlobal = await sharp(globalImage).resize({ width: 272 }).toBuffer();
  const heroEdge = await sharp(edgeImage).resize({ width: 272 }).toBuffer();
  const blipGlobal = await sharp(globalImage).resize({ width: 46 }).toBuffer();
  const blipEdge = await sharp(edgeImage).resize({ width: 46 }).toBuffer();
  const inspectionGlobal = await sharp(globalImage).resize({ width: 840 }).toBuffer();
  const inspectionEdge = await sharp(edgeImage).resize({ width: 840 }).toBuffer();
  const checker = checkerSvg(width, 340);
  const labels = labelSvg(width, height, [
    { x: 60, y: 64, value: 'A — global white key' },
    { x: 1020, y: 64, value: 'B — edge-connected white matte (selected)' },
    { x: 60, y: 748, value: 'Checkerboard alpha / edge inspection', size: 25 },
    { x: 60, y: 1040, value: '960 × 330 canvas · baseline y=290 · actual hero 272 px · actual blip 46 px · enlarged alpha inspection below', size: 24 },
  ]);
  await sharp(sky)
    .composite([
      { input: heroGlobal, left: 344, top: 190 },
      { input: heroEdge, left: 1304, top: 190 },
      { input: blipGlobal, left: 457, top: 510 },
      { input: blipEdge, left: 1417, top: 510 },
      { input: checker, left: 0, top: 740 },
      { input: inspectionGlobal, left: 60, top: 760 },
      { input: inspectionEdge, left: 1020, top: 760 },
      { input: labels, left: 0, top: 0 },
    ])
    .png()
    .toFile(join(outputDirectory, 'alpha-method-comparison.png'));
}

await mkdir(outputDirectory, { recursive: true });
const measurements = [];
const normalizedByMethod = new Map();
for (const name of sourceNames) {
  const inputPath = join(inputDirectory, `${name}.png`);
  for (const method of methods) {
    const { normalized, bounds } = await normalize(inputPath, method);
    normalizedByMethod.set(`${name}:${method}`, normalized);
    if (name === 'american-branded') {
      await sharp(normalized).png().toFile(join(outputDirectory, `${name}-${method}.png`));
    }
    for (const quality of qualities) {
      const filename = `${name}-${method}-q${quality}.webp`;
      const output = await sharp(normalized)
        .webp({ quality, alphaQuality: 100, smartSubsample: true, effort: 4 })
        .toBuffer();
      await writeFile(join(outputDirectory, filename), output);
      measurements.push({ source: basename(inputPath), method, quality, bytes: output.length, ...canvas, bounds });
    }
  }
}

await buildComparisonSheet(
  normalizedByMethod.get('american-branded:global-white-key'),
  normalizedByMethod.get('american-branded:edge-connected-white-matte'),
);
const report = {
  generatedBy: 'scripts/build-plane-art-reference.mjs',
  colorSpace: 'sRGB IEC61966-2.1; metadata normalized by libvips/sharp',
  selected: { method: 'edge-connected-white-matte', quality: 90, ...canvas },
  measurements,
};
await writeFile(join(outputDirectory, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${measurements.length} measurements and the visual comparison to ${outputDirectory}`);
