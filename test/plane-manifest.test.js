import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  LEGACY_PLANE_FALLBACKS,
  PLANE_APPROVAL_STATUSES,
  PLANE_ASSETS,
  PLANE_ASSETS_BY_KEY,
  PLANE_CATEGORIES,
  PLANE_DIRECTIONS,
  PLANE_SIZE_CLASSES,
} from '../assets/planes/v1/manifest.js';

const root = process.cwd();
const prompts = JSON.parse(await readFile(join(root, 'design', 'plane-art', 'prompts.json'), 'utf8'));

test('PG-002 manifest has unique stable directional records and controlled values', () => {
  assert.equal(new Set(PLANE_ASSETS.map(({ key }) => key)).size, PLANE_ASSETS.length);
  assert.equal(new Set(PLANE_ASSETS.map(({ artworkId, direction }) => `${artworkId}:${direction}`)).size, PLANE_ASSETS.length);
  assert.deepEqual(Object.keys(PLANE_ASSETS_BY_KEY), PLANE_ASSETS.map(({ key }) => key));

  for (const asset of PLANE_ASSETS) {
    assert.equal(asset.key, `${asset.artworkId}:${asset.direction}`);
    assert.ok(PLANE_DIRECTIONS.includes(asset.direction));
    assert.ok(PLANE_CATEGORIES.includes(asset.category));
    assert.ok(PLANE_SIZE_CLASSES.includes(asset.sizeClass));
    assert.ok(PLANE_APPROVAL_STATUSES.includes(asset.approvalStatus));
    assert.equal(asset.url, `/assets/planes/v1/${asset.artworkId}-${asset.direction}.webp`);
    assert.deepEqual([asset.width, asset.height], [960, 330]);
    assert.ok(Array.isArray(asset.applicableIcaoTypes));
    assert.ok(Array.isArray(asset.allowedCallsignPrefixes));
  }

  for (const artworkId of ['aal-narrowbody', 'generic-narrowbody', 'cessna-high-wing']) {
    const directions = PLANE_ASSETS.filter((asset) => asset.artworkId === artworkId)
      .map(({ direction }) => direction).sort();
    assert.deepEqual(directions, ['left', 'right']);
  }
});

test('PG-002 fallback chains are cycle-free and terminate safely', () => {
  const terminals = new Set(LEGACY_PLANE_FALLBACKS);
  for (const start of PLANE_ASSETS) {
    const visited = new Set();
    let current = start;
    while (!terminals.has(current.fallbackId)) {
      assert.ok(!visited.has(current.key), `fallback cycle from ${start.key}`);
      visited.add(current.key);
      current = PLANE_ASSETS_BY_KEY[`${current.fallbackId}:${start.direction}`];
      assert.ok(current, `missing fallback ${start.direction} record for ${start.key}`);
    }
  }
});

test('PG-002 prompt provenance and manifest output links are reciprocal', () => {
  assert.equal(prompts.schemaVersion, 2);
  assert.ok(prompts.records.length >= PLANE_ASSETS.length);
  assert.equal(new Set(prompts.records.map(({ key }) => key)).size, prompts.records.length);
  const byKey = Object.fromEntries(prompts.records.map((record) => [record.key, record]));

  for (const asset of PLANE_ASSETS) {
    const record = byKey[asset.promptRecordKey];
    assert.ok(record, `missing ${asset.promptRecordKey}`);
    assert.equal(record.artworkId, asset.artworkId);
    assert.equal(record.direction, asset.direction);
    assert.equal(record.modelId, asset.generationModel);
    assert.equal(record.output.manifestKey, asset.key);
    assert.equal(record.output.url, asset.url);
    for (const field of ['provider', 'projectId', 'modelId', 'prompt', 'candidateNotes', 'approvalNotes']) {
      assert.equal(typeof record[field], 'string');
      assert.ok(record[field].length > 0);
    }
    assert.ok(Array.isArray(record.referenceIds));
    if (asset.approvalStatus === 'approved') {
      assert.match(record.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(record.output.sha256, /^[a-f0-9]{64}$/);
    } else {
      assert.equal(record.generatedAt, null);
      assert.equal(record.output.sha256, null);
    }
  }
});

test('PG-008 mainline passenger pairs are independently generated and approved', () => {
  const artworkIds = [
    'aal-narrowbody', 'aal-widebody', 'ual-narrowbody', 'ual-widebody',
    'dal-narrowbody', 'dal-widebody', 'swa-narrowbody',
  ];
  const recordsByKey = Object.fromEntries(prompts.records.map((record) => [record.key, record]));
  const assets = PLANE_ASSETS.filter(({ artworkId }) => artworkIds.includes(artworkId));

  assert.equal(assets.length, 14);
  assert.equal(new Set(assets.map(({ artworkId }) => artworkId)).size, 7);
  assert.equal(new Set(assets.map(({ direction }) => direction)).size, 2);
  assert.equal(new Set(assets.map(({ artworkId, direction }) => `${artworkId}:${direction}`)).size, 14);

  for (const artworkId of artworkIds) {
    const pair = assets.filter((asset) => asset.artworkId === artworkId);
    assert.deepEqual(pair.map(({ direction }) => direction).sort(), ['left', 'right']);
    assert.ok(pair.every(({ approvalStatus }) => approvalStatus === 'approved'));
    const pairRecords = pair.map((asset) => recordsByKey[asset.promptRecordKey]);
    assert.ok(pairRecords.every(({ status }) => status === 'approved'));
    assert.equal(new Set(pairRecords.map(({ output }) => output.sha256)).size, 2, `${artworkId} directions must have independent bytes`);
    for (const record of pairRecords) {
      assert.match(record.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(record.output.sha256, /^[a-f0-9]{64}$/);
      assert.match(record.approvalNotes, /272 px hero and 46 px blip/);
      assert.match(record.approvalNotes, /directional pair was reviewed together/i);
    }
  }
});

test('PG-009 cargo, regional, and generic pairs are independently generated and approved', () => {
  const artworkIds = [
    'fdx-widebody', 'ups-widebody', 'american-eagle-regional',
    'generic-regional', 'generic-narrowbody', 'generic-widebody',
  ];
  const recordsByKey = Object.fromEntries(prompts.records.map((record) => [record.key, record]));
  const assets = PLANE_ASSETS.filter(({ artworkId }) => artworkIds.includes(artworkId));

  assert.equal(assets.length, 12);
  assert.equal(new Set(assets.map(({ artworkId }) => artworkId)).size, 6);
  assert.equal(new Set(assets.map(({ direction }) => direction)).size, 2);
  assert.equal(new Set(assets.map(({ artworkId, direction }) => `${artworkId}:${direction}`)).size, 12);

  for (const artworkId of artworkIds) {
    const pair = assets.filter((asset) => asset.artworkId === artworkId);
    assert.deepEqual(pair.map(({ direction }) => direction).sort(), ['left', 'right']);
    assert.ok(pair.every(({ approvalStatus }) => approvalStatus === 'approved'));
    const pairRecords = pair.map((asset) => recordsByKey[asset.promptRecordKey]);
    assert.ok(pairRecords.every(({ status }) => status === 'approved'));
    assert.equal(new Set(pairRecords.map(({ output }) => output.sha256)).size, 2, `${artworkId} directions must have independent bytes`);
    for (const record of pairRecords) {
      assert.match(record.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(record.output.sha256, /^[a-f0-9]{64}$/);
      assert.match(record.approvalNotes, /272 px hero and 46 px blip/);
      assert.match(record.approvalNotes, /directional pair was reviewed together/i);
    }
  }

  for (const artworkId of ['generic-regional', 'generic-narrowbody', 'generic-widebody']) {
    for (const record of prompts.records.filter((item) => item.artworkId === artworkId)) {
      assert.match(record.approvalNotes, /No airline name, logo, registration, or recognizable brand mark is present/);
    }
  }
  assert.deepEqual(
    assets.find(({ artworkId, direction }) => artworkId === 'american-eagle-regional' && direction === 'right').allowedCallsignPrefixes,
    ['ENY', 'JIA'],
  );
});

test('PG-010 business, light-aircraft, and agricultural pairs are independently generated and approved', () => {
  const artworkIds = ['generic-bizjet-small', 'cessna-high-wing', 'air-tractor-yellow'];
  const recordsByKey = Object.fromEntries(prompts.records.map((record) => [record.key, record]));
  const assets = PLANE_ASSETS.filter(({ artworkId }) => artworkIds.includes(artworkId));

  assert.equal(assets.length, 6);
  assert.equal(new Set(assets.map(({ artworkId }) => artworkId)).size, 3);
  assert.equal(new Set(assets.map(({ direction }) => direction)).size, 2);

  for (const artworkId of artworkIds) {
    const pair = assets.filter((asset) => asset.artworkId === artworkId);
    assert.deepEqual(pair.map(({ direction }) => direction).sort(), ['left', 'right']);
    assert.ok(pair.every(({ approvalStatus }) => approvalStatus === 'approved'));
    const pairRecords = pair.map((asset) => recordsByKey[asset.promptRecordKey]);
    assert.ok(pairRecords.every(({ status }) => status === 'approved'));
    assert.equal(new Set(pairRecords.map(({ output }) => output.sha256)).size, 2, `${artworkId} directions must have independent bytes`);
    for (const record of pairRecords) {
      assert.match(record.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(record.output.sha256, /^[a-f0-9]{64}$/);
      assert.match(record.prompt, /registration must be fictional or omitted/i);
      assert.match(record.approvalNotes, /272 px hero and 46 px blip/);
      assert.match(record.approvalNotes, /directional pair was reviewed together/i);
    }
  }

  assert.ok(assets.filter(({ artworkId }) => artworkId === 'generic-bizjet-small').every(({ category }) => category === 'business'));
  assert.ok(assets.filter(({ artworkId }) => artworkId === 'cessna-high-wing').every(({ category }) => category === 'general-aviation'));
  assert.ok(assets.filter(({ artworkId }) => artworkId === 'air-tractor-yellow').every(({ category }) => category === 'crop-duster'));
});

test('PG-002 public manifest contains no generation runtime or private paths', async () => {
  const source = await readFile(join(root, 'assets', 'planes', 'v1', 'manifest.js'), 'utf8');
  for (const forbidden of ['.secrets', 'credential', 'private_key', 'access_token', 'vertexai', '.generated', 'proofs/']) {
    assert.equal(source.toLowerCase().includes(forbidden), false, `public manifest contains ${forbidden}`);
  }
});
