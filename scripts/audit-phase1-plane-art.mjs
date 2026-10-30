import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import { PROCESSING_SETTINGS } from './process-plane-art.mjs';

export const PHASE1_TREATMENT_IDS = Object.freeze([
  'aal-narrowbody', 'aal-widebody', 'ual-narrowbody', 'ual-widebody',
  'dal-narrowbody', 'dal-widebody', 'swa-narrowbody', 'fdx-widebody',
  'ups-widebody', 'american-eagle-regional', 'generic-regional',
  'generic-narrowbody', 'generic-widebody', 'generic-bizjet-small',
  'cessna-high-wing', 'air-tractor-yellow',
]);

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower)));
}

export function byteDistribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    min: sorted[0] ?? null,
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    mean: sorted.length ? Math.round(total / sorted.length) : null,
    p75: percentile(sorted, 0.75),
    max: sorted.at(-1) ?? null,
    total,
  };
}

function alphaInspection(data, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  let transparentPixels = 0;
  let translucentPixels = 0;
  let opaquePixels = 0;
  for (let offset = 3, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    const alpha = data[offset];
    if (alpha === 0) {
      transparentPixels += 1;
      continue;
    }
    if (alpha === 255) opaquePixels += 1;
    else translucentPixels += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return {
    bounds: right < 0 ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 },
    transparentPixels,
    translucentPixels,
    opaquePixels,
    cornerAlpha: [
      data[3],
      data[((width - 1) * 4) + 3],
      data[(((height - 1) * width) * 4) + 3],
      data[(((height * width) - 1) * 4) + 3],
    ],
  };
}

async function inspectAsset(root, asset) {
  const path = join(root, asset.url.replace(/^\//, ''));
  const bytes = await readFile(path);
  const image = sharp(bytes, { failOn: 'warning' });
  const metadata = await image.metadata();
  const raw = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = alphaInspection(raw.data, raw.info.width, raw.info.height);
  const inTarget = bytes.length >= PROCESSING_SETTINGS.byteRange.min
    && bytes.length <= PROCESSING_SETTINGS.byteRange.max;
  return {
    key: asset.key,
    artworkId: asset.artworkId,
    direction: asset.direction,
    url: asset.url,
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.length,
    inTarget,
    format: metadata.format,
    hasAlpha: metadata.hasAlpha === true,
    alpha,
  };
}

/** Build the reproducible measurement record used by the PG-011 visual gate. */
export async function auditPhase1PlaneArt({ root = defaultRoot, assets = PLANE_ASSETS } = {}) {
  const promptCatalog = JSON.parse(await readFile(join(root, 'design', 'plane-art', 'prompts.json'), 'utf8'));
  const promptByKey = new Map(promptCatalog.records.map((record) => [record.key, record]));
  const phase1 = assets.filter((asset) => PHASE1_TREATMENT_IDS.includes(asset.artworkId));
  const inspected = await Promise.all(phase1.map((asset) => inspectAsset(root, asset)));
  const byId = new Map(PHASE1_TREATMENT_IDS.map((id) => [id, []]));
  for (const asset of inspected) byId.get(asset.artworkId)?.push(asset);
  const pairs = PHASE1_TREATMENT_IDS.map((artworkId) => {
    const assetsForId = byId.get(artworkId).sort((a, b) => b.direction.localeCompare(a.direction));
    const [right, left] = ['right', 'left'].map((direction) => assetsForId.find((asset) => asset.direction === direction));
    const widthRatio = right && left
      ? Number((Math.max(right.alpha.bounds.width, left.alpha.bounds.width) / Math.min(right.alpha.bounds.width, left.alpha.bounds.width)).toFixed(3))
      : null;
    const heightRatio = right && left
      ? Number((Math.max(right.alpha.bounds.height, left.alpha.bounds.height) / Math.min(right.alpha.bounds.height, left.alpha.bounds.height)).toFixed(3))
      : null;
    return { artworkId, right, left, alphaBoundsRatio: { width: widthRatio, height: heightRatio } };
  });
  const exceptions = inspected.filter((asset) => !asset.inTarget);
  return {
    schemaVersion: 1,
    phase: 'Phase 1',
    treatmentCount: PHASE1_TREATMENT_IDS.length,
    imageCount: inspected.length,
    generation: {
      providers: [...new Set(phase1.map((asset) => promptByKey.get(asset.promptRecordKey)?.provider))].sort(),
      modelIds: [...new Set(phase1.map((asset) => promptByKey.get(asset.promptRecordKey)?.modelId))].sort(),
      promptRevisions: [...new Set(phase1.map((asset) => promptByKey.get(asset.promptRecordKey)?.key.match(/:([^:]+)$/)?.[1]))].sort(),
      generationAmendments: (promptCatalog.generationAmendments ?? []).map(({ id }) => id),
      effectiveFuturePromptRevisions: [...new Set(phase1.map((asset) => [
        promptByKey.get(asset.promptRecordKey)?.key.match(/:([^:]+)$/)?.[1],
        ...(promptCatalog.generationAmendments ?? []).map(({ id }) => id),
      ].filter(Boolean).join('+')))].sort(),
      approvedPromptRecords: phase1.filter((asset) => promptByKey.get(asset.promptRecordKey)?.status === 'approved').length,
      repairedPromptRecords: phase1.filter((asset) => promptByKey.get(asset.promptRecordKey)?.repair?.issue === 'PG-011').length,
      lightingRepairAssets: phase1.filter((asset) => promptByKey.get(asset.promptRecordKey)?.repair?.issue === 'PG-011').map((asset) => asset.key).sort(),
    },
    settings: PROCESSING_SETTINGS,
    dimensions: [...new Set(inspected.map(({ width, height }) => `${width}x${height}`))],
    byteDistribution: byteDistribution(inspected.map(({ bytes }) => bytes)),
    targetExceptions: exceptions.map(({ key, bytes }) => ({ key, bytes, reason: bytes < PROCESSING_SETTINGS.byteRange.min ? 'below' : 'above' })),
    alphaSummary: {
      imagesWithAlpha: inspected.filter(({ hasAlpha }) => hasAlpha).length,
      imagesWithTransparentCorners: inspected.filter(({ alpha }) => alpha.cornerAlpha.every((value) => value === 0)).length,
      baselineValues: [...new Set(inspected.map(({ alpha }) => alpha.bounds?.bottom).filter(Number.isInteger))].sort((a, b) => a - b),
      minimumPadding: {
        left: Math.min(...inspected.map(({ alpha }) => alpha.bounds.left)),
        right: Math.min(...inspected.map(({ width, alpha }) => width - alpha.bounds.right - 1)),
        top: Math.min(...inspected.map(({ alpha }) => alpha.bounds.top)),
        belowBaseline: Math.min(...inspected.map(({ height, alpha }) => height - alpha.bounds.bottom - 1)),
      },
    },
    pairs,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase1PlaneArt(), null, 2));
}
