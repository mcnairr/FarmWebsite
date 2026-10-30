import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const planPath = join(root, 'design', 'plane-graphics-plan2.md');
const promptsPath = join(root, 'design', 'plane-art', 'prompts.json');
const inventoryPath = join(root, 'design', 'plane-art', 'shape-guides', 'inventory.json');

async function readJsonIfPresent(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

const existingCatalog = await readJsonIfPresent(promptsPath);
const existingInventory = await readJsonIfPresent(inventoryPath);
const existingRecords = new Map((existingCatalog?.records ?? []).map((record) => [record.key, record]));
const existingGuides = new Map((existingInventory?.guides ?? []).map((guide) => [guide.id, guide]));

const plan = await readFile(planPath, 'utf8');
const matrix = plan.slice(plan.indexOf('## Planned artwork matrix'), plan.indexOf('## ICAO type and callsign resolution'));
const treatments = [...matrix.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)]
  .map((match) => ({ number: Number(match[1]), id: match[2], name: match[3].trim(), shape: match[4].trim() }));

if (treatments.length !== 74) throw new Error(`Expected 74 approved treatments, found ${treatments.length}`);

const trijets = new Set(['fdx-trijet', 'ups-trijet']);
const fourEngineJets = new Set(['dlh-b747', 'baw-a380', 'c17-military', 'kc135-military']);
const twinProps = new Set(['beech-piston', 'king-air', 'dash8', 'atr', 'generic-twin-piston']);
const singleProps = new Set([
  'cessna-high-wing', 'cessna-caravan', 'piper-low-wing', 'cirrus-low-wing',
  'pilatus-pc12', 'daher-tbm', 'air-tractor-yellow', 'air-tractor-red-white',
  'thrush-yellow-blue', 'crop-duster-green',
]);
const helicopters = new Set(['bell-206', 'bell-407', 'h135-medical', 'police-helicopter', 'utility-helicopter']);
const fixedGear = new Set([
  'cessna-high-wing', 'cessna-caravan', 'piper-low-wing', 'cirrus-low-wing',
  'air-tractor-yellow', 'air-tractor-red-white', 'thrush-yellow-blue', 'crop-duster-green',
]);

function category(number) {
  if (number >= 25 && number <= 30) return 'cargo';
  if (number <= 34 || (number >= 38 && number <= 47)) return 'scheduled-passenger';
  if (number <= 37) return 'scheduled-passenger';
  if (number <= 51) return 'business';
  if (number <= 56 || number === 62) return 'general-aviation';
  if (number <= 61) return 'turboprop';
  if (number <= 66) return 'crop-duster';
  if (number <= 71) return 'helicopter';
  return 'military';
}

function anatomy(id) {
  if (helicopters.has(id)) return { engineCount: id === 'h135-medical' ? 2 : 1, propellerCount: 0, mainRotorCount: 1, tailRotorCount: 1, landingGear: 'aircraft-family-accurate skids or fixed wheels' };
  if (id === 'c130-military') return { engineCount: 4, propellerCount: 4, mainRotorCount: 0, tailRotorCount: 0, landingGear: 'retracted' };
  if (singleProps.has(id)) return { engineCount: 1, propellerCount: 1, mainRotorCount: 0, tailRotorCount: 0, landingGear: fixedGear.has(id) ? 'fixed and fully visible' : 'retracted' };
  if (twinProps.has(id)) return { engineCount: 2, propellerCount: 2, mainRotorCount: 0, tailRotorCount: 0, landingGear: 'retracted' };
  return {
    engineCount: trijets.has(id) ? 3 : fourEngineJets.has(id) ? 4 : 2,
    propellerCount: 0, mainRotorCount: 0, tailRotorCount: 0, landingGear: 'retracted',
  };
}

function identityRules(treatment, treatmentCategory) {
  if (treatmentCategory === 'military') return 'Use neutral military gray with no unit, squadron, base, insignia, serial, or official affiliation.';
  if (treatment.id === 'h135-medical') return 'Use generic recognizable medical-service colors and symbols; do not copy or imply a real provider or agency. Any registration must be fictional or omitted.';
  if (treatment.id === 'police-helicopter') return 'Use a generic police treatment; do not copy a real agency name, badge, insignia, or locality. Any registration must be fictional or omitted.';
  if (treatment.id === 'utility-helicopter') return 'Use a generic news/utility treatment with no real organization, station, or agency. Any registration must be fictional or omitted.';
  if (['business', 'general-aviation', 'turboprop', 'crop-duster', 'helicopter'].includes(treatmentCategory)) {
    const branded = treatment.id === 'netjets-bizjet' || treatment.id === 'flexjet-bizjet';
    return branded
      ? `Apply recognizable ${treatment.name} branding, correctly oriented and readable. Any registration must be fictional or omitted.`
      : `Apply the specified ${treatment.name} treatment as original paint with no copied private identity. Any registration must be fictional or omitted.`;
  }
  if (treatment.id.startsWith('generic-')) return `Use ${treatment.name}; include no airline name, logo, registration, or recognizable brand mark.`;
  return `Apply recognizable ${treatment.name} branding and livery with the primary name correctly oriented and readable.`;
}

function slugShape(shape) {
  return shape.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function categoryConstraints(id, treatmentCategory) {
  const constraints = [];
  if (fixedGear.has(id)) constraints.push('Keep the fixed landing gear structurally accurate, fully visible, and attached; do not retract or omit it.');
  if (singleProps.has(id) || twinProps.has(id) || id === 'c130-military') constraints.push('Show every specified propeller with a plausible hub, blades, placement, and clearance.');
  if (helicopters.has(id)) constraints.push('Preserve one complete main-rotor system and one aircraft-family-accurate anti-torque tail-rotor system; do not add wings or airplane propellers.');
  if (trijets.has(id)) constraints.push('Preserve the MD-11 trijet layout: two under-wing engines and one distinct tail-mounted center engine.');
  if (id === 'dlh-b747') constraints.push('Preserve the Boeing 747-8 jumbo silhouette, four under-wing engines, and its distinctive forward upper-deck hump.');
  if (id === 'baw-a380') constraints.push('Preserve the Airbus A380 super-jumbo silhouette, four under-wing engines, and full-length double-deck fuselage profile.');
  if (treatmentCategory === 'crop-duster') constraints.push('Preserve purpose-built agricultural crop-duster anatomy, including robust fixed gear and believable spray-boom/application hardware.');
  return constraints;
}

const sharedConstraints = [
  'lightly polished photorealistic style with believable anatomy, proportions, materials, daylight, and camera perspective',
  'single aircraft, full-aircraft crop, centered with generous even padding and no cropped parts',
  'plain pure-white removable background; no scenery, clouds, contrails, people, watermark, border, or ground shadow',
  'mostly side-on three-quarter view with the requested nose direction',
  'do not mirror or flip an image',
];

const guideMap = new Map();
for (const treatment of treatments) {
  const id = slugShape(treatment.shape);
  guideMap.set(id, { id, family: treatment.shape, treatmentIds: [...(guideMap.get(id)?.treatmentIds ?? []), treatment.id] });
}

const inventory = {
  schemaVersion: 1,
  policy: {
    description: 'Shape guides must be original project-authored diagrams or inputs with documented reuse permission. Unlicensed model/reference inputs are prohibited.',
    missingGuideBehavior: 'Block generation and record the task; never substitute a merely similar or incompatible silhouette.',
  },
  guides: [...guideMap.values()].map((guide) => ({
    status: 'missing', file: null,
    provenance: 'Planned original project-authored shape guide; no source file exists yet.',
    ownership: 'McNair Farms project',
    permission: 'Not applicable until the original guide is created; no third-party or unlicensed input is authorized.',
    blockedTask: `Create and review an original ${guide.family} shape guide before generation.`,
    ...existingGuides.get(guide.id),
    ...guide,
  })),
};
const guideStatusById = new Map(inventory.guides.map((guide) => [guide.id, guide.status]));

const records = [];
for (const treatment of treatments) {
  const treatmentCategory = category(treatment.number);
  const counts = anatomy(treatment.id);
  const guideId = slugShape(treatment.shape);
  const specificConstraints = categoryConstraints(treatment.id, treatmentCategory);
  const countText = `exactly ${counts.engineCount} engine${counts.engineCount === 1 ? '' : 's'}, ${counts.propellerCount} propeller${counts.propellerCount === 1 ? '' : 's'}, ${counts.mainRotorCount} main rotor${counts.mainRotorCount === 1 ? '' : 's'}, and ${counts.tailRotorCount} tail rotor${counts.tailRotorCount === 1 ? '' : 's'}`;
  const identity = identityRules(treatment, treatmentCategory);
  for (const direction of ['right', 'left']) {
    const key = `${treatment.id}:${direction}:v1`;
    const previous = existingRecords.get(key);
    const guideMissing = guideStatusById.get(guideId) !== 'available';
    const directionText = direction === 'right' ? 'nose pointing right' : 'nose pointing left';
    const consistency = direction === 'left'
      ? `Use the approved ${treatment.id}:right:v1 result as a style, lighting, paint, and livery reference, but create a new independent image. Do not mirror it. `
      : '';
    records.push({
      key, artworkId: treatment.id, direction,
      treatmentName: treatment.name, category: treatmentCategory, aircraftShape: treatment.shape,
      anatomy: counts,
      categoryConstraints: specificConstraints,
      shapeGuideId: guideId,
      status: guideMissing ? 'blocked-missing-shape-guide' : previous?.status === 'blocked-missing-shape-guide' ? 'ready' : (previous?.status ?? 'ready'),
      blockedReason: guideMissing ? `Shape guide ${guideId} is missing; generation is prohibited until its inventory status is available.` : null,
      provider: 'Google Cloud Vertex AI', projectId: 'simbusiness-13e1f', modelId: 'gemini-3.1-flash-image',
      prompt: `${consistency}Create one ${treatment.shape} aircraft in the approved lightly polished photorealistic production style, ${directionText}. Preserve this treatment's aircraft family and show ${countText}; landing gear must be ${counts.landingGear}. ${specificConstraints.join(' ')} ${identity} Show the entire aircraft centered with generous even padding. Use believable anatomy, proportions, materials, clean daylight, and restrained highlights. Use a plain pure-white removable background. No scenery, clouds, contrails, people, watermark, border, ground shadow, cropped parts, or extra aircraft. Branding and all text must read normally for this ${direction}-facing view.`,
      sharedConstraintIds: sharedConstraints.map((_, index) => `global-${index + 1}`),
      referenceIds: ['production-spec', 'vertex-style-proof', `shape-guide:${guideId}`],
      styleReferenceKey: direction === 'left' ? `${treatment.id}:right:v1` : null,
      generatedAt: previous?.generatedAt ?? null,
      candidateNotes: previous?.candidateNotes ?? 'Generation is blocked until the original shape guide is created, documented, and reviewed.',
      approvalNotes: previous?.approvalNotes ?? 'Not generated or approved.',
      output: { manifestKey: `${treatment.id}:${direction}`, url: `/assets/planes/v1/${treatment.id}-${direction}.webp`, sha256: previous?.output?.sha256 ?? null },
    });
  }
}

const catalog = {
  schemaVersion: 2,
  canonicalMatrix: 'design/plane-graphics-plan2.md#planned-artwork-matrix',
  sharedConstraints: sharedConstraints.map((text, index) => ({ id: `global-${index + 1}`, text })),
  referenceCatalog: [
    { id: 'production-spec', type: 'file', file: 'design/plane-art/README.md', provenance: 'Project-authored production decision record.', ownership: 'McNair Farms project', permission: 'Project-owned; approved for this production workflow.' },
    { id: 'vertex-style-proof', type: 'file', file: 'design/plane-art/proofs/vertex/american-branded.png', provenance: 'Generated by the project owner with Google Cloud Vertex AI on 2026-10-29; generation metadata is in proofs/vertex/metadata.json.', ownership: 'McNair Farms project-generated asset', permission: 'Approved for internal style reference in this project; not a shape guide.' },
  ],
  records,
};

await mkdir(dirname(inventoryPath), { recursive: true });
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
await writeFile(promptsPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${records.length} prompt records and ${inventory.guides.length} shape-guide inventory records.`);
