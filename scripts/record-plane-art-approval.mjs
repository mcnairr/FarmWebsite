import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const ids = (args.ids ?? '').split(',').filter(Boolean);
const direction = args.direction;
if (!ids.length || !['right', 'left'].includes(direction) || !args.notes) {
  throw new Error('Usage: node scripts/record-plane-art-approval.mjs --ids <comma-list> --direction <right|left> --notes <manual-review-notes>');
}

const promptPath = join('design', 'plane-art', 'prompts.json');
const catalog = JSON.parse(await readFile(promptPath, 'utf8'));

for (const id of ids) {
  const record = catalog.records.find((item) => item.artworkId === id && item.direction === direction);
  if (!record) throw new Error(`Unknown prompt record ${id}:${direction}`);
  const report = JSON.parse(await readFile(join('.generated', 'plane-art', 'processed', `${id}-${direction}.json`), 'utf8'));
  const metadata = JSON.parse(await readFile(report.source.metadata, 'utf8'));
  if (report.asset.key !== `${id}:${direction}` || metadata.requestKey !== report.source.requestKey) {
    throw new Error(`Processing provenance mismatch for ${id}:${direction}`);
  }
  record.status = 'approved';
  record.generatedAt = metadata.requestTime;
  record.candidateNotes = `Vertex request ${metadata.requestKey} returned one independently generated ${direction}-facing candidate; processed with the frozen edge-connected white-matte recipe.`;
  record.approvalNotes = args.notes;
  record.output.sha256 = report.output.sha256;
}
await writeFile(promptPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Recorded manual approval for ${ids.length} ${direction}-facing assets.`);
