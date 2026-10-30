import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const trijets = new Set(['fdx-trijet', 'ups-trijet']);
const fourEngineJets = new Set(['dlh-b747', 'baw-a380', 'c17-military', 'kc135-military']);
const twinProps = new Set(['beech-piston', 'king-air', 'dash8', 'atr', 'generic-twin-piston']);
const singleProps = new Set(['cessna-high-wing', 'cessna-caravan', 'piper-low-wing', 'cirrus-low-wing', 'pilatus-pc12', 'daher-tbm', 'air-tractor-yellow', 'air-tractor-red-white', 'thrush-yellow-blue', 'crop-duster-green']);
const helicopters = new Set(['bell-206', 'bell-407', 'h135-medical', 'police-helicopter', 'utility-helicopter']);

function matrixRows(markdown) {
  const section = markdown.slice(markdown.indexOf('## Planned artwork matrix'), markdown.indexOf('## ICAO type and callsign resolution'));
  return [...section.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)]
    .map((match) => ({ number: Number(match[1]), id: match[2], name: match[3].trim(), shape: match[4].trim() }));
}

function expectedCategory(number) {
  if (number >= 25 && number <= 30) return 'cargo';
  if (number <= 47) return 'scheduled-passenger';
  if (number <= 51) return 'business';
  if (number <= 56 || number === 62) return 'general-aviation';
  if (number <= 61) return 'turboprop';
  if (number <= 66) return 'crop-duster';
  if (number <= 71) return 'helicopter';
  return 'military';
}

function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }

function expectedCounts(id) {
  if (helicopters.has(id)) return [id === 'h135-medical' ? 2 : 1, 0, 1, 1];
  if (id === 'c130-military') return [4, 4, 0, 0];
  if (singleProps.has(id)) return [1, 1, 0, 0];
  if (twinProps.has(id)) return [2, 2, 0, 0];
  return [trijets.has(id) ? 3 : fourEngineJets.has(id) ? 4 : 2, 0, 0, 0];
}

/** Validate parsed PG-003 data. Returns all failures so one run is actionable. */
export async function validatePlanePromptCatalog({ root = defaultRoot, prompts, inventory, plan } = {}) {
  const errors = [];
  const parsedPlan = plan ?? await readFile(join(root, 'design', 'plane-graphics-plan2.md'), 'utf8');
  const catalog = prompts ?? JSON.parse(await readFile(join(root, 'design', 'plane-art', 'prompts.json'), 'utf8'));
  const guides = inventory ?? JSON.parse(await readFile(join(root, 'design', 'plane-art', 'shape-guides', 'inventory.json'), 'utf8'));
  const matrix = matrixRows(parsedPlan);
  const matrixById = new Map(matrix.map((row) => [row.id, row]));
  const guideById = new Map(guides.guides.map((guide) => [guide.id, guide]));
  const recordKeys = new Set();
  const referenceIds = (catalog.referenceCatalog ?? []).map(({ id }) => id);
  const sharedIds = (catalog.sharedConstraints ?? []).map(({ id }) => id);

  if (matrix.length !== 74) errors.push(`canonical matrix contains ${matrix.length} treatments, expected 74`);
  if (catalog.records.length !== 148) errors.push(`catalog contains ${catalog.records.length} prompts, expected 148`);
  if (guideById.size !== guides.guides.length) errors.push('duplicate shape-guide id');
  if (new Set(referenceIds).size !== referenceIds.length) errors.push('duplicate reference id');
  if (new Set(sharedIds).size !== sharedIds.length) errors.push('duplicate shared-constraint id');

  for (const reference of catalog.referenceCatalog ?? []) {
    for (const field of ['id', 'type', 'file', 'provenance', 'ownership', 'permission']) {
      if (!nonempty(reference[field])) errors.push(`reference ${reference.id ?? '<unknown>'} missing ${field}`);
    }
    if (reference.type === 'file' && nonempty(reference.file)) {
      try { await access(resolve(root, reference.file)); } catch { errors.push(`reference file does not exist: ${reference.file}`); }
    }
  }
  const references = new Map((catalog.referenceCatalog ?? []).map((reference) => [reference.id, reference]));

  for (const guide of guides.guides ?? []) {
    for (const field of ['id', 'family', 'status', 'provenance', 'ownership', 'permission']) {
      if (!nonempty(guide[field])) errors.push(`shape guide ${guide.id ?? '<unknown>'} missing ${field}`);
    }
    if (guide.status === 'available') {
      if (!nonempty(guide.file)) errors.push(`available shape guide ${guide.id} missing file`);
      else try { await access(resolve(root, guide.file)); } catch { errors.push(`shape-guide file does not exist: ${guide.file}`); }
    } else if (guide.status === 'missing') {
      if (guide.file !== null) errors.push(`missing shape guide ${guide.id} must have a null file`);
      if (!nonempty(guide.blockedTask)) errors.push(`missing shape guide ${guide.id} missing blockedTask`);
    } else errors.push(`shape guide ${guide.id} has unknown status ${guide.status}`);
    for (const treatmentId of guide.treatmentIds ?? []) if (!matrixById.has(treatmentId)) errors.push(`shape guide ${guide.id} has unknown treatment id ${treatmentId}`);
  }

  for (const record of catalog.records ?? []) {
    if (recordKeys.has(record.key)) errors.push(`duplicate prompt key: ${record.key}`);
    recordKeys.add(record.key);
    const matrixRow = matrixById.get(record.artworkId);
    if (!matrixRow) errors.push(`unknown artwork id: ${record.artworkId}`);
    for (const field of ['key', 'artworkId', 'direction', 'treatmentName', 'category', 'aircraftShape', 'shapeGuideId', 'status', 'provider', 'projectId', 'modelId', 'prompt', 'candidateNotes', 'approvalNotes']) {
      if (!nonempty(record[field])) errors.push(`${record.key ?? '<unknown>'} missing ${field}`);
    }
    if (!['left', 'right'].includes(record.direction)) errors.push(`${record.key} has invalid direction ${record.direction}`);
    if (record.key !== `${record.artworkId}:${record.direction}:v1`) errors.push(`${record.key} is not the canonical prompt key`);
    if (matrixRow) {
      if (record.treatmentName !== matrixRow.name) errors.push(`${record.key} treatment name differs from canonical matrix`);
      if (record.aircraftShape !== matrixRow.shape) errors.push(`${record.key} aircraft shape differs from canonical matrix`);
      if (record.category !== expectedCategory(matrixRow.number)) errors.push(`${record.key} has incorrect category ${record.category}`);
    }
    for (const field of ['engineCount', 'propellerCount', 'mainRotorCount', 'tailRotorCount']) {
      if (!Number.isInteger(record.anatomy?.[field]) || record.anatomy[field] < 0) errors.push(`${record.key} missing valid anatomy.${field}`);
    }
    if (matrixRow) {
      const actual = ['engineCount', 'propellerCount', 'mainRotorCount', 'tailRotorCount'].map((field) => record.anatomy?.[field]);
      const expected = expectedCounts(record.artworkId);
      if (actual.some((value, index) => value !== expected[index])) errors.push(`${record.key} has incorrect engine/propeller/rotor counts`);
    }
    if (!nonempty(record.anatomy?.landingGear)) errors.push(`${record.key} missing anatomy.landingGear`);
    if (!Array.isArray(record.categoryConstraints)) errors.push(`${record.key} missing categoryConstraints`);
    if (!Array.isArray(record.referenceIds) || record.referenceIds.length === 0) errors.push(`${record.key} missing referenceIds`);
    if (!Array.isArray(record.sharedConstraintIds) || record.sharedConstraintIds.length === 0) errors.push(`${record.key} missing sharedConstraintIds`);
    for (const constraintId of record.sharedConstraintIds ?? []) if (!sharedIds.includes(constraintId)) errors.push(`${record.key} references unknown shared constraint ${constraintId}`);
    for (const referenceId of record.referenceIds ?? []) {
      if (referenceId.startsWith('shape-guide:')) {
        if (!guideById.has(referenceId.slice('shape-guide:'.length))) errors.push(`${record.key} references unknown shape guide ${referenceId}`);
      } else if (!references.has(referenceId)) errors.push(`${record.key} references unknown reference ${referenceId}`);
    }
    const guide = guideById.get(record.shapeGuideId);
    if (!guide) errors.push(`${record.key} has unknown shapeGuideId ${record.shapeGuideId}`);
    if (guide?.status === 'missing' && (record.status !== 'blocked-missing-shape-guide' || !nonempty(record.blockedReason))) {
      errors.push(`${record.key} does not clearly block its missing shape guide`);
    }
    const promptText = typeof record.prompt === 'string' ? record.prompt : '';
    if (record.direction === 'left') {
      const expectedRight = `${record.artworkId}:right:v1`;
      if (record.styleReferenceKey !== expectedRight) errors.push(`${record.key} must reference ${expectedRight}`);
      if (!/independent image/i.test(promptText) || !/do not mirror/i.test(promptText)) errors.push(`${record.key} does not request an independent, unmirrored left image`);
    } else if (record.styleReferenceKey !== null) errors.push(`${record.key} right prompt must not have a styleReferenceKey`);
    for (const phrase of ['entire aircraft', 'no scenery', 'watermark', 'ground shadow']) {
      if (!promptText.toLowerCase().includes(phrase)) errors.push(`${record.key} prompt missing global constraint: ${phrase}`);
    }
    const countPhrases = [`exactly ${record.anatomy?.engineCount} engine`, `${record.anatomy?.propellerCount} propeller`, `${record.anatomy?.mainRotorCount} main rotor`, `${record.anatomy?.tailRotorCount} tail rotor`];
    for (const phrase of countPhrases) if (!promptText.includes(phrase)) errors.push(`${record.key} prompt does not state ${phrase}`);
    if (['business', 'general-aviation', 'turboprop', 'crop-duster', 'helicopter'].includes(record.category)
      && !/fictional or omitted/i.test(promptText)) errors.push(`${record.key} missing private-registration rule`);
    if (!record.output || record.output.manifestKey !== `${record.artworkId}:${record.direction}` || !nonempty(record.output.url)) errors.push(`${record.key} missing output link`);
  }

  for (const row of matrix) for (const direction of ['right', 'left']) {
    if (!recordKeys.has(`${row.id}:${direction}:v1`)) errors.push(`missing prompt key: ${row.id}:${direction}:v1`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await validatePlanePromptCatalog();
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else console.log('Plane prompt catalog is valid: 74 treatments, 148 directional prompts.');
}
