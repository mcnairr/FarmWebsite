import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const generatedRoot = join(root, '.generated', 'plane-art');
const script = join(root, 'scripts', 'generate-plane-library.ps1');

async function fixture({ guideStatus = 'available', rightApproved = false } = {}) {
  await mkdir(generatedRoot, { recursive: true });
  const directory = await mkdtemp(join(generatedRoot, 'generator-test-'));
  const rel = (path) => relative(root, path).replaceAll('\\', '/');
  const reference = join(directory, 'style.png');
  const guide = join(directory, 'guide.png');
  const spec = join(directory, 'spec.md');
  const approved = join(directory, 'approved');
  await mkdir(approved);
  await writeFile(reference, 'style-reference');
  await writeFile(guide, 'shape-guide');
  await writeFile(spec, '# Test production spec\n');

  let rightHash = null;
  if (rightApproved) {
    const rightFile = join(approved, 'test-plane-right.webp');
    await writeFile(rightFile, 'approved-right');
    const { createHash } = await import('node:crypto');
    rightHash = createHash('sha256').update('approved-right').digest('hex');
  }

  const records = ['right', 'left'].map((direction) => ({
    key: `test-plane:${direction}:v1`,
    artworkId: 'test-plane',
    direction,
    shapeGuideId: 'test-shape',
    status: direction === 'right' && rightApproved ? 'approved' : 'ready',
    projectId: 'example-project-123',
    modelId: 'gemini-3.1-flash-image',
    prompt: `Create the independent test aircraft facing ${direction}; do not mirror it.`,
    referenceIds: ['production-spec', 'vertex-style-proof', 'shape-guide:test-shape'],
    styleReferenceKey: direction === 'left' ? 'test-plane:right:v1' : null,
    output: { sha256: direction === 'right' ? rightHash : null },
  }));
  const catalog = {
    schemaVersion: 2,
    generationAmendments: [{ id: 'pg011-lighting-1', text: 'Use clean, even upper-surface daylight without smoke-like dark shading.' }],
    referenceCatalog: [
      { id: 'production-spec', file: rel(spec) },
      { id: 'vertex-style-proof', file: rel(reference) },
    ],
    records,
  };
  const inventory = {
    schemaVersion: 1,
    guides: [{ id: 'test-shape', status: guideStatus, file: guideStatus === 'available' ? rel(guide) : null }],
  };
  const catalogPath = join(directory, 'prompts.json');
  const inventoryPath = join(directory, 'inventory.json');
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  return { directory, catalogPath, inventoryPath, approved, output: join(directory, 'output') };
}

function run(args) {
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

const compact = (text) => text.replace(/\s+/g, ' ');

function commonArgs(value) {
  return [
    '-CatalogPath', value.catalogPath,
    '-ShapeGuideInventoryPath', value.inventoryPath,
    '-GeneratedRoot', value.output,
    '-ApprovedRoot', value.approved,
  ];
}

test('PG-004 dry run reports exact request inputs and outputs without creating generation state', async (t) => {
  const value = await fixture();
  t.after(() => rm(value.directory, { recursive: true, force: true }));
  const result = run([...commonArgs(value), '-ArtworkId', 'test-plane', '-Direction', 'right', '-DryRun']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Estimated Vertex requests: 1/);
  assert.match(result.stdout, /\[GENERATE\] test-plane right/);
  assert.match(result.stdout, /prompt revision: test-plane:right:v1\+pg011-lighting-1/);
  assert.match(result.stdout, /input: shape-guide:test-shape/);
  assert.match(result.stdout, /raw output: .*candidates.*test-plane.*right/i);
  assert.match(result.stdout, /Model: gemini-3\.1-flash-image/);
  assert.match(result.stdout, /Dry run complete; Vertex was not called/);
  await assert.rejects(readFile(join(value.output, 'ledger.json')), { code: 'ENOENT' });
});

test('PG-004 refuses unknown IDs and an unconfirmed all-library selection', async (t) => {
  const value = await fixture();
  t.after(() => rm(value.directory, { recursive: true, force: true }));
  const unknown = run([...commonArgs(value), '-ArtworkId', 'not-known', '-Direction', 'right', '-DryRun']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown artwork ID/);
  const all = run([...commonArgs(value), '-All', '-Direction', 'right', '-DryRun']);
  assert.notEqual(all.status, 0);
  assert.match(compact(all.stderr), /requires both -All and -ConfirmAll/);
});

test('PG-004 blocks missing guides and requires an approved hash-matching right input for left generation', async (t) => {
  const missing = await fixture({ guideStatus: 'missing' });
  const noApproval = await fixture();
  const approved = await fixture({ rightApproved: true });
  t.after(async () => Promise.all([missing, noApproval, approved].map((value) => rm(value.directory, { recursive: true, force: true }))));

  const missingResult = run([...commonArgs(missing), '-ArtworkId', 'test-plane', '-Direction', 'right', '-DryRun']);
  assert.notEqual(missingResult.status, 0);
  assert.match(compact(missingResult.stderr), /Shape guide 'test-shape' is not available/);

  const unapprovedResult = run([...commonArgs(noApproval), '-ArtworkId', 'test-plane', '-Direction', 'left', '-DryRun']);
  assert.notEqual(unapprovedResult.status, 0);
  assert.match(compact(unapprovedResult.stderr), /approved right treatment with a recorded SHA-256 is required/i);

  const approvedResult = run([...commonArgs(approved), '-ArtworkId', 'test-plane', '-Direction', 'left', '-DryRun']);
  assert.equal(approvedResult.status, 0, approvedResult.stderr);
  assert.match(approvedResult.stdout, /input: test-plane:right:v1/);
});

test('PG-004 rejects output paths outside the gitignored plane-art workspace', async (t) => {
  const value = await fixture();
  t.after(() => rm(value.directory, { recursive: true, force: true }));
  const result = run([
    '-CatalogPath', value.catalogPath,
    '-ShapeGuideInventoryPath', value.inventoryPath,
    '-GeneratedRoot', join(root, 'design', 'unsafe-output'),
    '-ApprovedRoot', value.approved,
    '-ArtworkId', 'test-plane', '-Direction', 'right', '-DryRun',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsafe output path/);
});

test('PG-004 checkpoint skips completed requests unless Force is explicit', async (t) => {
  const value = await fixture();
  t.after(() => rm(value.directory, { recursive: true, force: true }));
  const args = [...commonArgs(value), '-ArtworkId', 'test-plane', '-Direction', 'right', '-DryRun'];
  const initial = run(args);
  assert.equal(initial.status, 0, initial.stderr);
  const outputMatch = initial.stdout.match(/raw output: (.+)/);
  assert.ok(outputMatch);
  const requestDirectory = outputMatch[1].trim();
  const requestKey = requestDirectory.split(/[\\/]/).at(-1);
  await mkdir(requestDirectory, { recursive: true });
  await writeFile(join(requestDirectory, 'metadata.json'), `${JSON.stringify({ requestKey })}\n`);
  await writeFile(join(value.output, 'ledger.json'), `${JSON.stringify({
    schemaVersion: 1,
    requests: [{ requestKey, artworkId: 'test-plane', direction: 'right', status: 'completed' }],
  }, null, 2)}\n`);

  const resumed = run(args);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.match(resumed.stdout, /Estimated Vertex requests: 0/);
  assert.match(resumed.stdout, /\[SKIP completed\] test-plane right/);

  const forced = run([...args, '-Force']);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /Estimated Vertex requests: 1/);
  assert.match(forced.stdout, /\[GENERATE\] test-plane right/);
});

