import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('flight feed only references registered DOM elements', async () => {
  const source = await readFile(new URL('../flight-feed.js', import.meta.url), 'utf8');
  const registry = source.match(/const el = \{(?<body>[\s\S]*?)\n  \};/)?.groups?.body;

  assert.ok(registry, 'could not find the flight-feed element registry');

  const registered = new Set([...registry.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]));
  const referenced = new Set([...source.matchAll(/\bel\.(\w+)/g)].map((match) => match[1]));
  const missing = [...referenced].filter((name) => !registered.has(name)).sort();

  assert.deepEqual(missing, [], `unregistered DOM element references: ${missing.join(', ')}`);
});
