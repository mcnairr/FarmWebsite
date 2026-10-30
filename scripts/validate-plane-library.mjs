import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  LEGACY_PLANE_FALLBACKS,
  PLANE_APPROVAL_STATUSES,
  PLANE_ASSETS,
  PLANE_CATEGORIES,
  PLANE_DIRECTIONS,
  PLANE_SIZE_CLASSES,
} from '../assets/planes/v1/manifest.js';
import { PROCESSING_SETTINGS } from './process-plane-art.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ICAO = /^[A-Z0-9]{2,8}$/;
const SAFE_PREFIX = /^[A-Z]{3}$/;
const PUBLIC_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs']);
const HELICOPTER_ICAO = /^(?:A1(?:09|19|39|49|69|89)|AS(?:32|33|50|55|65)|B0?6|B407|BK17|EC(?:20|25|30|35|45|55|65)|H1(?:25|30|35|45|55|60|75)|R(?:22|44|66)|S(?:58|61|64|70|76|92)|UH60)/;
const FIXED_WING_ICAO = /^(?:A(?:2|3|4)|AT[4578]|B(?:7|C)|BCS|BE|C(?:1|2|3|4|5|6|7)|CRJ|D[ACH]|E(?:1|2|7)|F[2-9]|G[1-9]|LJ|MD|P(?:28|A)|SR)/;
const SECRET_PATTERNS = [
  ['PEM private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
  ['OAuth access token', /ya29\.[0-9A-Za-z_-]{20,}/],
  ['GitHub access token', /gh[pousr]_[0-9A-Za-z]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['service-account private key', /["']private_key["']\s*:\s*["'][^"']+/i],
];
const VERTEX_RUNTIME_PATTERNS = [
  /@google-cloud\/vertexai/i,
  /\bvertexai\b/i,
  /aiplatform\.googleapis\.com/i,
  /GoogleAuth[^\n]*(?:aiplatform|vertex)/i,
];

function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function unique(values) { return new Set(values).size === values.length; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function publicPathForUrl(root, url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.includes('\\') || url.includes('?') || url.includes('#')) return null;
  const path = resolve(root, `.${url}`);
  return relative(root, path).startsWith('..') ? null : path;
}
function canonicalArray(value) { return Array.isArray(value) ? [...value].sort().join('\0') : null; }
function onePerTreatment(assets) {
  const treatments = new Map();
  for (const asset of assets) if (!treatments.has(asset.artworkId)) treatments.set(asset.artworkId, asset);
  return [...treatments.values()];
}

/**
 * Safety probe used by validation tests. It can return only a URL already
 * present in the manifest; input strings are never interpolated into a path.
 */
export function resolveAuthoredValidationAsset(input, assets = PLANE_ASSETS) {
  const direction = PLANE_DIRECTIONS.includes(input?.direction) ? input.direction : 'right';
  const rawIcao = typeof input?.icaoType === 'string' ? input.icaoType.trim().toUpperCase() : '';
  const rawCallsign = typeof input?.callsign === 'string' ? input.callsign.trim().toUpperCase() : '';
  const icao = SAFE_ICAO.test(rawIcao) ? rawIcao : null;
  const callsignMatch = /^([A-Z]{3})[A-Z0-9]{1,7}$/.exec(rawCallsign);
  const prefix = callsignMatch?.[1] ?? null;
  const directional = assets.filter((asset) => asset.direction === direction);
  const compatible = icao ? directional.filter((asset) => asset.applicableIcaoTypes?.includes(icao)) : [];
  const branded = prefix ? compatible.find((asset) => asset.allowedCallsignPrefixes?.includes(prefix)) : null;
  if (branded) return branded;
  return compatible.find((asset) => asset.artworkId?.startsWith('generic-'))
    ?? directional.find((asset) => asset.artworkId?.startsWith('generic-'))
    ?? null;
}

async function collectPublicFiles(root) {
  const files = [];
  const addTree = async (directory) => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await addTree(path);
      else if (entry.isFile() && PUBLIC_EXTENSIONS.has(extname(entry.name))) files.push(path);
    }
  };
  await addTree(join(root, 'assets'));
  await addTree(join(root, 'api', 'src'));
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && PUBLIC_EXTENSIONS.has(extname(entry.name))) files.push(join(root, entry.name));
  }
  return Promise.all(files.map(async (path) => ({ path: relative(root, path).replaceAll('\\', '/'), source: await readFile(path, 'utf8') })));
}

function validatePublicSource({ path, source }, errors) {
  for (const [name, pattern] of SECRET_PATTERNS) if (pattern.test(source)) errors.push(`public file ${path} contains ${name} material`);
  for (const pattern of VERTEX_RUNTIME_PATTERNS) if (pattern.test(source)) {
    errors.push(`public file ${path} contains a Vertex runtime/SDK reference`);
    break;
  }
}

function validateMappings(assets, errors) {
  const terminals = new Set(LEGACY_PLANE_FALLBACKS);
  const byKey = new Map(assets.map((asset) => [asset.key, asset]));
  const exactMappings = new Map();
  for (const asset of onePerTreatment(assets)) {
    for (const [field, values] of [['ICAO type', asset.applicableIcaoTypes], ['callsign prefix', asset.allowedCallsignPrefixes]]) {
      if (Array.isArray(values) && !unique(values)) errors.push(`${asset.artworkId} has a duplicate ${field} mapping`);
    }
    for (const icao of asset.applicableIcaoTypes ?? []) {
      if (!SAFE_ICAO.test(icao)) errors.push(`${asset.artworkId} has unsafe ICAO mapping '${icao}'`);
      const isHelicopter = HELICOPTER_ICAO.test(icao);
      if (asset.category === 'helicopter' && FIXED_WING_ICAO.test(icao)) errors.push(`${asset.artworkId} maps helicopter artwork to non-helicopter ICAO type ${icao}`);
      if (asset.category !== 'helicopter' && isHelicopter) errors.push(`${asset.artworkId} maps ${asset.category} artwork to helicopter ICAO type ${icao}`);
    }
    for (const prefix of asset.allowedCallsignPrefixes ?? []) if (!SAFE_PREFIX.test(prefix)) errors.push(`${asset.artworkId} has unsafe callsign prefix '${prefix}'`);
    if (asset.allowedCallsignPrefixes?.length && !asset.applicableIcaoTypes?.length) errors.push(`${asset.artworkId} has callsign-prefix mappings without a compatible ICAO mapping`);
    const prefixes = asset.allowedCallsignPrefixes?.length ? asset.allowedCallsignPrefixes : ['*'];
    for (const prefix of prefixes) for (const icao of asset.applicableIcaoTypes ?? []) {
      const key = `${prefix}:${icao}`;
      const previous = exactMappings.get(key);
      if (previous && previous !== asset.artworkId) errors.push(`conflicting exact mapping ${key} resolves to both ${previous} and ${asset.artworkId}`);
      else exactMappings.set(key, asset.artworkId);
    }
  }
  for (const start of assets) {
    const visited = new Set();
    let current = start;
    while (current && !terminals.has(current.fallbackId)) {
      if (visited.has(current.key)) { errors.push(`fallback cycle starts at ${start.key}`); break; }
      visited.add(current.key);
      const nextKey = `${current.fallbackId}:${start.direction}`;
      current = byKey.get(nextKey);
      if (!current) {
        errors.push(`${start.key} fallback '${start.fallbackId}' has no ${start.direction} manifest record or explicit legacy terminal`);
        break;
      }
    }
  }
}

async function validateApprovedImage(root, asset, prompt, errors) {
  const path = publicPathForUrl(root, asset.url);
  if (!path) { errors.push(`${asset.key} has an unsafe or non-public URL '${asset.url}'`); return; }
  let bytes;
  try { bytes = await readFile(path); } catch {
    errors.push(`${asset.key} approved image is missing at ${relative(root, path).replaceAll('\\', '/')}`);
    return;
  }
  if (bytes.length > PROCESSING_SETTINGS.byteRange.max) errors.push(`${asset.key} is ${bytes.length} bytes; ceiling is ${PROCESSING_SETTINGS.byteRange.max}`);
  let metadata;
  try { metadata = await sharp(bytes, { failOn: 'warning' }).metadata(); } catch (error) {
    errors.push(`${asset.key} is not a readable image: ${error.message}`);
    return;
  }
  if (metadata.format !== 'webp') errors.push(`${asset.key} image type is ${metadata.format ?? 'unknown'}, expected WebP`);
  if (metadata.width !== asset.width || metadata.height !== asset.height) errors.push(`${asset.key} intrinsic dimensions are ${metadata.width}x${metadata.height}, manifest declares ${asset.width}x${asset.height}`);
  if (metadata.width !== PROCESSING_SETTINGS.canvas.width || metadata.height !== PROCESSING_SETTINGS.canvas.height) errors.push(`${asset.key} violates the ${PROCESSING_SETTINGS.canvas.width}x${PROCESSING_SETTINGS.canvas.height} canvas ceiling`);
  if (!metadata.hasAlpha) errors.push(`${asset.key} has no alpha channel`);
  if (!/^[a-f0-9]{64}$/.test(prompt?.output?.sha256 ?? '')) errors.push(`${asset.key} approved prompt metadata is missing output.sha256`);
  else if (prompt.output.sha256 !== sha256(bytes)) errors.push(`${asset.key} image hash does not match approved prompt metadata`);
}

/** Validate the complete authored plane-library contract and return all failures. */
export async function validatePlaneLibrary({ root = defaultRoot, assets = PLANE_ASSETS, prompts, publicFiles } = {}) {
  const errors = [];
  const catalog = prompts ?? JSON.parse(await readFile(join(root, 'design', 'plane-art', 'prompts.json'), 'utf8'));
  const records = Array.isArray(catalog.records) ? catalog.records : [];
  const promptByKey = new Map(records.map((record) => [record.key, record]));
  const assetByKey = new Map();
  const groups = new Map();

  for (const asset of assets) {
    if (assetByKey.has(asset.key)) errors.push(`duplicate manifest key ${asset.key}`);
    assetByKey.set(asset.key, asset);
    const pairKey = `${asset.artworkId}:${asset.direction}`;
    if (asset.key !== pairKey) errors.push(`${asset.key} must equal artworkId:direction (${pairKey})`);
    if (!SAFE_ID.test(asset.artworkId ?? '')) errors.push(`${asset.key} has unsafe artworkId '${asset.artworkId}'`);
    if (!PLANE_DIRECTIONS.includes(asset.direction)) errors.push(`${asset.key} has invalid direction '${asset.direction}'`);
    if (!PLANE_CATEGORIES.includes(asset.category)) errors.push(`${asset.key} has invalid category '${asset.category}'`);
    if (!PLANE_SIZE_CLASSES.includes(asset.sizeClass)) errors.push(`${asset.key} has invalid sizeClass '${asset.sizeClass}'`);
    if (!PLANE_APPROVAL_STATUSES.includes(asset.approvalStatus)) errors.push(`${asset.key} has invalid approvalStatus '${asset.approvalStatus}'`);
    const expectedUrl = `/assets/planes/v1/${asset.artworkId}-${asset.direction}.webp`;
    if (asset.url !== expectedUrl) errors.push(`${asset.key} URL must be the authored canonical URL ${expectedUrl}`);
    if (asset.width !== PROCESSING_SETTINGS.canvas.width || asset.height !== PROCESSING_SETTINGS.canvas.height) errors.push(`${asset.key} manifest canvas must be ${PROCESSING_SETTINGS.canvas.width}x${PROCESSING_SETTINGS.canvas.height}`);
    if (!Array.isArray(asset.applicableIcaoTypes)) errors.push(`${asset.key} applicableIcaoTypes must be an array`);
    if (!Array.isArray(asset.allowedCallsignPrefixes)) errors.push(`${asset.key} allowedCallsignPrefixes must be an array`);
    if (!nonempty(asset.fallbackId)) errors.push(`${asset.key} is missing an explicit fallbackId`);
    const group = groups.get(asset.artworkId) ?? [];
    group.push(asset); groups.set(asset.artworkId, group);

    const prompt = promptByKey.get(asset.promptRecordKey);
    if (!prompt) errors.push(`${asset.key} links missing prompt record ${asset.promptRecordKey}`);
    else {
      if (prompt.artworkId !== asset.artworkId || prompt.direction !== asset.direction) errors.push(`${asset.key} prompt identity does not match the manifest`);
      if (prompt.category !== asset.category) errors.push(`${asset.key} category '${asset.category}' contradicts prompt category '${prompt.category}'`);
      if (prompt.modelId !== asset.generationModel) errors.push(`${asset.key} generation model does not match its prompt record`);
      if (prompt.output?.manifestKey !== asset.key || prompt.output?.url !== asset.url) errors.push(`${asset.key} prompt output link is not reciprocal`);
      const hasRotors = (prompt.anatomy?.mainRotorCount ?? 0) > 0 || (prompt.anatomy?.tailRotorCount ?? 0) > 0;
      if ((asset.category === 'helicopter') !== hasRotors) errors.push(`${asset.key} category contradicts its recorded rotor anatomy`);
    }
  }

  for (const [artworkId, group] of groups) {
    const directions = group.map((asset) => asset.direction);
    if (!unique(directions)) errors.push(`${artworkId} has duplicate directional manifest records`);
    for (const field of ['category', 'sizeClass', 'fallbackId']) if (new Set(group.map((asset) => asset[field])).size > 1) errors.push(`${artworkId} has conflicting ${field} values between directions`);
    for (const field of ['applicableIcaoTypes', 'allowedCallsignPrefixes']) if (new Set(group.map((asset) => canonicalArray(asset[field]))).size > 1) errors.push(`${artworkId} has conflicting ${field} mappings between directions`);
    if (group.some((asset) => asset.approvalStatus === 'approved')
      && (group.length !== 2 || !PLANE_DIRECTIONS.every((direction) => group.some((asset) => asset.direction === direction && asset.approvalStatus === 'approved')))) {
      errors.push(`${artworkId} is approved without exactly one approved left and one approved right record`);
    }
  }

  validateMappings(assets, errors);
  for (const record of records.filter((item) => item.status === 'approved')) {
    const asset = assetByKey.get(record.output?.manifestKey);
    if (!asset) errors.push(`${record.key} is approved but has no manifest asset`);
    else if (asset.approvalStatus !== 'approved') errors.push(`${record.key} is approved but ${asset.key} is not approved`);
  }
  for (const asset of assets.filter((item) => item.approvalStatus === 'approved')) {
    const prompt = promptByKey.get(asset.promptRecordKey);
    if (prompt?.status !== 'approved') errors.push(`${asset.key} is approved but prompt ${asset.promptRecordKey} is not approved`);
    await validateApprovedImage(root, asset, prompt, errors);
  }

  for (const file of publicFiles ?? await collectPublicFiles(root)) validatePublicSource(file, errors);
  const hostileValues = ['../aal-narrowbody', '..\\aal-narrowbody', '/assets/planes/v1/evil.webp', '<script>alert(1)</script>', 'AAL%2f..%2fevil', '" onerror="alert(1)', 'constructor', '__proto__', 'A'.repeat(2048), '\0B738', '💥'];
  const authoredUrls = new Set(assets.map((asset) => asset.url));
  for (const value of hostileValues) {
    const result = resolveAuthoredValidationAsset({ icaoType: value, callsign: value, airlineName: value }, assets);
    if (result && (!result.artworkId.startsWith('generic-') || !authoredUrls.has(result.url))) errors.push(`hostile input resolved outside authored generic assets: ${JSON.stringify(value)}`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await validatePlaneLibrary();
  if (errors.length) {
    console.error(`Plane library validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    const approved = PLANE_ASSETS.filter(({ approvalStatus }) => approvalStatus === 'approved').length;
    console.log(`Plane library is valid: ${PLANE_ASSETS.length} manifest records, ${approved} approved images.`);
  }
}
