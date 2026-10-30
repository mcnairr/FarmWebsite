import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { validatePlanePromptCatalog } from '../scripts/validate-plane-prompt-catalog.mjs';

const root = process.cwd();
const prompts = JSON.parse(await readFile(join(root, 'design', 'plane-art', 'prompts.json'), 'utf8'));
const inventory = JSON.parse(await readFile(join(root, 'design', 'plane-art', 'shape-guides', 'inventory.json'), 'utf8'));
const plan = await readFile(join(root, 'design', 'plane-graphics-plan2.md'), 'utf8');
const copy = (value) => structuredClone(value);

test('PG-003 catalog contains every treatment and independent directional prompt', async () => {
  assert.deepEqual(await validatePlanePromptCatalog({ root, prompts, inventory, plan }), []);
  assert.equal(prompts.records.length, 148);
  assert.equal(new Set(prompts.records.map(({ artworkId }) => artworkId)).size, 74);
  assert.deepEqual(
    Object.fromEntries(['scheduled-passenger', 'cargo', 'business', 'general-aviation', 'turboprop', 'crop-duster', 'helicopter', 'military']
      .map((category) => [category, prompts.records.filter((record) => record.category === category).length / 2])),
    { 'scheduled-passenger': 41, cargo: 6, business: 4, 'general-aviation': 6, turboprop: 5, 'crop-duster': 4, helicopter: 5, military: 3 },
  );
  for (const left of prompts.records.filter(({ direction }) => direction === 'left')) {
    assert.equal(left.styleReferenceKey, `${left.artworkId}:right:v1`);
    assert.match(left.prompt, /independent image/i);
    assert.match(left.prompt, /do not mirror/i);
  }
});

test('PG-003 anatomy records cover category-specific engine, propeller, rotor, and gear rules', () => {
  const byKey = Object.fromEntries(prompts.records.map((record) => [record.key, record]));
  assert.deepEqual(byKey['fdx-trijet:right:v1'].anatomy.engineCount, 3);
  assert.deepEqual(byKey['dlh-b747:right:v1'].anatomy.engineCount, 4);
  assert.deepEqual(byKey['c130-military:right:v1'].anatomy, {
    engineCount: 4, propellerCount: 4, mainRotorCount: 0, tailRotorCount: 0, landingGear: 'retracted',
  });
  assert.equal(byKey['cessna-high-wing:right:v1'].anatomy.landingGear, 'fixed and fully visible');
  assert.equal(byKey['cessna-high-wing:right:v1'].anatomy.propellerCount, 1);
  assert.equal(byKey['bell-407:right:v1'].anatomy.mainRotorCount, 1);
  assert.equal(byKey['bell-407:right:v1'].anatomy.tailRotorCount, 1);
  assert.match(byKey['fdx-trijet:right:v1'].categoryConstraints.join(' '), /tail-mounted center engine/i);
  assert.match(byKey['dlh-b747:right:v1'].categoryConstraints.join(' '), /upper-deck hump/i);
  assert.match(byKey['baw-a380:right:v1'].categoryConstraints.join(' '), /full-length double-deck/i);
  assert.match(byKey['air-tractor-yellow:right:v1'].categoryConstraints.join(' '), /agricultural crop-duster anatomy/i);
  assert.match(byKey['police-helicopter:right:v1'].prompt, /generic police treatment/i);
  assert.match(byKey['c17-military:right:v1'].prompt, /no unit, squadron, base, insignia/i);
});

test('PG-003 validator detects duplicate prompt keys and unknown IDs', async () => {
  const duplicate = copy(prompts);
  duplicate.records[1].key = duplicate.records[0].key;
  assert.ok((await validatePlanePromptCatalog({ root, prompts: duplicate, inventory, plan })).some((error) => error.includes('duplicate prompt key')));

  const unknown = copy(prompts);
  unknown.records[0].artworkId = 'unknown-plane';
  assert.ok((await validatePlanePromptCatalog({ root, prompts: unknown, inventory, plan })).some((error) => error.includes('unknown artwork id')));
});

test('PG-003 validator detects missing prompt fields and reference files', async () => {
  const missingField = copy(prompts);
  delete missingField.records[0].prompt;
  assert.ok((await validatePlanePromptCatalog({ root, prompts: missingField, inventory, plan })).some((error) => error.includes('missing prompt')));

  const missingReference = copy(prompts);
  missingReference.referenceCatalog[0].file = 'design/plane-art/does-not-exist.png';
  assert.ok((await validatePlanePromptCatalog({ root, prompts: missingReference, inventory, plan })).some((error) => error.includes('reference file does not exist')));
});

test('PG-003 missing shape guides are explicit blocked tasks with provenance', () => {
  assert.ok(inventory.guides.length > 0);
  for (const guide of inventory.guides) {
    assert.equal(guide.status, 'missing');
    assert.equal(guide.file, null);
    assert.ok(guide.provenance && guide.ownership && guide.permission && guide.blockedTask);
    for (const treatmentId of guide.treatmentIds) {
      const records = prompts.records.filter((record) => record.artworkId === treatmentId);
      assert.equal(records.length, 2);
      assert.ok(records.every((record) => record.status === 'blocked-missing-shape-guide' && record.shapeGuideId === guide.id));
    }
  }
});
