import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { PLANE_ASSETS_BY_KEY } from '../assets/planes/v1/manifest.js';

export const PROCESSING_SETTINGS = Object.freeze({
  schemaVersion: 1,
  method: 'edge-connected-white-matte',
  canvas: Object.freeze({ width: 960, height: 330 }),
  contentBox: Object.freeze({ width: 888, height: 270 }),
  padding: Object.freeze({ horizontal: 36, top: 20, belowBaseline: 40 }),
  baseline: 290,
  webp: Object.freeze({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 4 }),
  byteRange: Object.freeze({ min: 40_000, max: 110_000 }),
  colorSpace: 'sRGB IEC 61966-2-1',
});

const DIRECTIONS = new Set(['left', 'right']);
const WHITE_CONNECTED_DISTANCE = 72;
const WHITE_TRANSPARENT_DISTANCE = 7;
const WHITE_FEATHER_DISTANCE = 65;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) { throw new Error(message); }
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function repositoryPath(path) {
  const value = relative(root, path).replaceAll('\\', '/');
  return value.startsWith('../') ? null : value;
}
function isWithin(parent, child) {
  const value = relative(parent, child);
  return value !== '' && !isAbsolute(value) && !value.startsWith('..');
}
function whiteDistance(r, g, b) {
  return Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
}
function unmatte(value, alpha) {
  if (alpha <= 0) return 0;
  const opacity = alpha / 255;
  return Math.max(0, Math.min(255, Math.round((value - 255 * (1 - opacity)) / opacity)));
}

export function edgeConnectedWhiteMatte(data, width, height) {
  const pixelCount = width * height;
  const connected = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const add = (pixel) => {
    if (connected[pixel]) return;
    const offset = pixel * 3;
    if (whiteDistance(data[offset], data[offset + 1], data[offset + 2]) > WHITE_CONNECTED_DISTANCE) return;
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
    const source = pixel * 3;
    const target = pixel * 4;
    const distance = whiteDistance(data[source], data[source + 1], data[source + 2]);
    const alpha = connected[pixel]
      ? Math.max(0, Math.min(255, Math.round(((distance - WHITE_TRANSPARENT_DISTANCE) / WHITE_FEATHER_DISTANCE) * 255)))
      : 255;
    output[target] = unmatte(data[source], alpha);
    output[target + 1] = unmatte(data[source + 1], alpha);
    output[target + 2] = unmatte(data[source + 2], alpha);
    output[target + 3] = alpha;
  }
  return output;
}

async function standardBackgroundRemoval(inputPath) {
  const { data, info } = await sharp(inputPath, { failOn: 'warning' })
    .rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const rgba = edgeConnectedWhiteMatte(data, info.width, info.height);
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function manualBackgroundRepair(inputPath) {
  const metadata = await sharp(inputPath, { failOn: 'warning' }).metadata();
  if (!metadata.hasAlpha) fail('Manual-repair input must contain an alpha channel.');
  return sharp(inputPath, { failOn: 'warning' }).rotate().ensureAlpha().toColourspace('srgb');
}

async function normalizedPng(processingPath, manualRepair) {
  const cleaned = manualRepair
    ? await manualBackgroundRepair(processingPath)
    : await standardBackgroundRemoval(processingPath);
  const trimmed = await cleaned
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .png().toBuffer({ resolveWithObject: true });
  if (trimmed.info.width < 2 || trimmed.info.height < 2) fail('Background removal left no usable aircraft pixels.');
  const resized = await sharp(trimmed.data)
    .resize({
      width: PROCESSING_SETTINGS.contentBox.width,
      height: PROCESSING_SETTINGS.contentBox.height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png().toBuffer({ resolveWithObject: true });
  const left = Math.round((PROCESSING_SETTINGS.canvas.width - resized.info.width) / 2);
  const top = PROCESSING_SETTINGS.baseline - resized.info.height;
  const png = await sharp({
    create: {
      ...PROCESSING_SETTINGS.canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: resized.data, left, top }]).png().toBuffer();
  return { png, bounds: { left, top, width: resized.info.width, height: resized.info.height } };
}

function inspectPixels(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let translucentPixels = 0;
  let possibleWhiteFringePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      if (alpha > 0 && alpha < 255) {
        translucentPixels += 1;
        // A low-opacity, almost-white RGB pixel is the characteristic residue
        // of a white matte. Fully opaque white paint is deliberately excluded.
        if (alpha < 224 && data[offset] > 248 && data[offset + 1] > 248 && data[offset + 2] > 248) {
          possibleWhiteFringePixels += 1;
        }
      }
    }
  }
  const corners = [0, (width - 1) * 4, ((height - 1) * width) * 4, (width * height - 1) * 4]
    .map((offset) => data[offset + 3]);
  return {
    alphaBounds: { left: minX, top: minY, right: maxX, bottom: maxY },
    translucentPixels,
    possibleWhiteFringePixels,
    cornerAlpha: corners,
  };
}

async function validateSourceMetadata(path, artworkId, direction, inputPath) {
  if (!path) return null;
  const source = JSON.parse(await readFile(path, 'utf8'));
  if (source.artworkId !== artworkId || source.direction !== direction) {
    fail(`Source metadata identifies '${source.artworkId}:${source.direction}', not '${artworkId}:${direction}'.`);
  }
  const candidates = Array.isArray(source.candidates) ? source.candidates : [];
  const inputName = basename(inputPath);
  const candidate = candidates.find(({ file }) => file === inputName);
  if (!candidate) fail(`Source metadata does not list input candidate '${inputName}'.`);
  const inputBytes = await readFile(inputPath);
  if (candidate.sha256 && candidate.sha256 !== sha256(inputBytes)) fail('Input hash does not match its source metadata.');
  return { requestKey: source.requestKey ?? null, promptRevision: source.promptRevision ?? null };
}

async function atomicWrite(path, buffer, replaceExisting = false) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  const backup = `${path}.replace-${process.pid}`;
  await writeFile(temporary, buffer, { flag: 'wx' });
  let backedUp = false;
  try {
    if (replaceExisting) {
      try { await rename(path, backup); backedUp = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await rename(temporary, path);
    if (backedUp) await unlink(backup);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    if (backedUp) await rename(backup, path).catch(() => {});
    throw error;
  }
}

async function proofSheet(webp, outputPath, artworkId, direction) {
  const sky = await sharp(join(root, 'Oats.jpg')).resize(960, 540, { fit: 'cover', position: 'top' }).toBuffer();
  const hero = await sharp(webp).resize({ width: 272 }).toBuffer();
  const blip = await sharp(webp).resize({ width: 46 }).toBuffer();
  const checker = Buffer.from('<svg width="960" height="300" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="24" height="24" patternUnits="userSpaceOnUse"><path fill="#fff" d="M0 0h24v24H0z"/><path fill="#d7dde5" d="M0 0h12v12H0zM12 12h12v12H12z"/></pattern></defs><path fill="url(#c)" d="M0 0h960v300H0z"/></svg>');
  const inspection = await sharp(webp).resize({ width: 840 }).toBuffer();
  const sheet = await sharp({ create: { width: 960, height: 840, channels: 4, background: '#fff' } })
    .composite([
      { input: sky, left: 0, top: 0 }, { input: hero, left: 344, top: 120 },
      { input: blip, left: 457, top: 380 }, { input: checker, left: 0, top: 540 },
      { input: inspection, left: 60, top: 550 },
    ]).png().toBuffer();
  await atomicWrite(outputPath, sheet);
}

export async function processPlaneArt(options) {
  const artworkId = options.artworkId;
  const direction = options.direction;
  if (!artworkId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artworkId)) fail('A safe, unambiguous --artwork-id is required.');
  if (!DIRECTIONS.has(direction)) fail("--direction must be exactly 'left' or 'right'.");
  const manifestRecord = PLANE_ASSETS_BY_KEY[`${artworkId}:${direction}`];
  if (!manifestRecord) fail(`Unknown manifest asset '${artworkId}:${direction}'.`);
  if (!options.inputPath) fail('--input is required.');
  const inputPath = resolve(options.inputPath);
  const manualRepairPath = options.manualRepairPath ? resolve(options.manualRepairPath) : null;
  const processingPath = manualRepairPath ?? inputPath;
  await access(inputPath);
  if (manualRepairPath) await access(manualRepairPath);
  const sourceLink = await validateSourceMetadata(
    options.sourceMetadataPath ? resolve(options.sourceMetadataPath) : null,
    artworkId, direction, inputPath,
  );
  const outputPath = options.outputPath
    ? resolve(options.outputPath)
    : join(root, 'assets', 'planes', 'v1', `${artworkId}-${direction}.webp`);
  const expectedOutput = join(root, 'assets', 'planes', 'v1', `${artworkId}-${direction}.webp`);
  if (resolve(outputPath) !== expectedOutput) fail(`Production output must be exactly assets/planes/v1/${artworkId}-${direction}.webp.`);
  let previousSha256 = null;
  try {
    const previous = await readFile(outputPath);
    previousSha256 = sha256(previous);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previousSha256 && (!options.replaceApproved || !options.replacementNote?.trim())) {
    fail('Output already exists; use --replace-approved with --replacement-note for the explicit replacement workflow.');
  }

  const inputBytes = await readFile(inputPath);
  const processingBytes = manualRepairPath ? await readFile(manualRepairPath) : inputBytes;
  const { png, bounds } = await normalizedPng(processingPath, Boolean(manualRepairPath));
  const webp = await sharp(png).webp(PROCESSING_SETTINGS.webp).toBuffer();
  const metadata = await sharp(webp).metadata();
  const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelChecks = inspectPixels(data, info.width, info.height);
  const checks = {
    format: metadata.format === 'webp',
    dimensions: metadata.width === 960 && metadata.height === 330,
    alpha: metadata.hasAlpha === true,
    colorSpace: metadata.space === 'srgb',
    transparentCorners: pixelChecks.cornerAlpha.every((alpha) => alpha === 0),
    horizontalPadding: pixelChecks.alphaBounds.left >= 36 && pixelChecks.alphaBounds.right <= 923,
    topPadding: pixelChecks.alphaBounds.top >= 20,
    baseline: pixelChecks.alphaBounds.bottom === 289,
    belowBaseline: pixelChecks.alphaBounds.bottom <= 289,
    // White-painted aircraft legitimately have pale antialiased edges. Reject
    // a broad matte (over 10% of all translucent edge pixels), not isolated
    // pale detail retained by the approved edge-connected method.
    whiteFringe: pixelChecks.possibleWhiteFringePixels <= Math.max(8, Math.floor(pixelChecks.translucentPixels * 0.1)),
    byteRange: webp.length >= PROCESSING_SETTINGS.byteRange.min && webp.length <= PROCESSING_SETTINGS.byteRange.max,
    byteCeiling: webp.length <= PROCESSING_SETTINGS.byteRange.max,
  };
  const requiredChecks = Object.entries(checks).filter(([name]) => name !== 'byteRange');
  const failures = requiredChecks.filter(([, passed]) => !passed).map(([name]) => name);
  if (!checks.byteRange && !options.byteExceptionNote?.trim()) failures.push('byteRange');
  if (failures.length) fail(`Processed asset failed checks: ${failures.join(', ')} (possible white-fringe pixels: ${pixelChecks.possibleWhiteFringePixels}/${pixelChecks.translucentPixels}).`);

  const report = {
    schemaVersion: PROCESSING_SETTINGS.schemaVersion,
    asset: { key: `${artworkId}:${direction}`, artworkId, direction, output: repositoryPath(outputPath) },
    source: {
      input: repositoryPath(inputPath) ?? basename(inputPath), sha256: sha256(inputBytes),
      metadata: options.sourceMetadataPath ? (repositoryPath(resolve(options.sourceMetadataPath)) ?? basename(options.sourceMetadataPath)) : null,
      ...sourceLink,
      manualRepair: manualRepairPath ? {
        input: repositoryPath(manualRepairPath) ?? basename(manualRepairPath), sha256: sha256(processingBytes),
      } : null,
    },
    processing: {
      ...PROCESSING_SETTINGS,
      mirrorOrFlip: false,
      sharp: sharp.versions.sharp,
      libvips: sharp.versions.vips,
      deterministicEquivalent: 'Stable pixels, bytes, and metadata are expected for identical inputs, settings, and recorded Sharp/libvips versions.',
      bounds,
    },
    output: { width: metadata.width, height: metadata.height, format: metadata.format, hasAlpha: metadata.hasAlpha, bytes: webp.length, sha256: sha256(webp) },
    checks: { ...checks, ...pixelChecks },
    exceptions: { byteRange: options.byteExceptionNote?.trim() || null },
    replacement: previousSha256 ? { previousSha256, note: options.replacementNote.trim() } : null,
  };
  const reportPath = options.reportPath
    ? resolve(options.reportPath)
    : join(root, '.generated', 'plane-art', 'processed', `${artworkId}-${direction}.json`);
  const generatedRoot = join(root, '.generated', 'plane-art');
  const resolvedProofPath = options.proofPath ? resolve(options.proofPath) : null;
  if (!isWithin(generatedRoot, reportPath)) fail('Processing reports must stay below .generated/plane-art/.');
  if (resolvedProofPath && !isWithin(generatedRoot, resolvedProofPath)) fail('Proof output must stay below .generated/plane-art/.');
  await atomicWrite(outputPath, webp, Boolean(previousSha256));
  await atomicWrite(reportPath, Buffer.from(`${JSON.stringify(report, null, 2)}\n`), true);
  if (resolvedProofPath) {
    await unlink(resolvedProofPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await proofSheet(webp, resolvedProofPath, artworkId, direction);
  }
  return { report, outputPath, reportPath };
}

function parseArguments(argv) {
  const options = {};
  const valueOptions = new Map([
    ['--artwork-id', 'artworkId'], ['--direction', 'direction'], ['--input', 'inputPath'],
    ['--manual-repair', 'manualRepairPath'], ['--source-metadata', 'sourceMetadataPath'],
    ['--report', 'reportPath'], ['--proof', 'proofPath'], ['--replacement-note', 'replacementNote'],
    ['--byte-exception-note', 'byteExceptionNote'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--replace-approved') { options.replaceApproved = true; continue; }
    const key = valueOptions.get(argument);
    if (!key || index + 1 >= argv.length) fail(`Unknown or incomplete argument '${argument}'.`);
    options[key] = argv[++index];
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await processPlaneArt(options);
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => { process.stderr.write(`process-plane-art: ${error.message}\n`); process.exitCode = 1; });
}
