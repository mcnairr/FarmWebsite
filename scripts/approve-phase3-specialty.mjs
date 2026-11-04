import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ids = ['thrush-yellow-blue', 'crop-duster-green', 'bell-206', 'bell-407', 'h135-medical', 'police-helicopter', 'utility-helicopter'];
const direction = process.argv[2];
if (!['right', 'left'].includes(direction)) throw new Error('Pass right or left.');

const catalogPath = resolve('design/plane-art/prompts.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
for (const id of ids) {
  const record = catalog.records.find((item) => item.key === `${id}:${direction}:v1`);
  if (!record) throw new Error(`Missing prompt record for ${id}:${direction}.`);
  const report = JSON.parse(await readFile(resolve(`.generated/plane-art/processed/${id}-${direction}.json`), 'utf8'));
  const metadata = JSON.parse(await readFile(resolve(`.generated/plane-art/candidates/${id}/${direction}/${report.source.requestKey}/metadata.json`), 'utf8'));
  record.status = 'approved';
  record.generatedAt = metadata.requestTime;
  record.candidateNotes = `Vertex request ${report.source.requestKey} returned one independently generated ${direction}-facing PG-024 candidate on uniform magenta; processed with deterministic global chroma extraction at distance 120. Manual-repair SHA-256: ${report.source.manualRepair.sha256}.`;
  record.approvalNotes = `Approved 2026-11-03 for PG-024 after production-sky and checkerboard review: direction, silhouette, engine/propeller/rotor anatomy, landing gear or skids, agricultural equipment where applicable, category identity, non-affiliation, crop, baseline, alpha edges, and hero/blip recognition pass. Output is ${report.output.bytes} bytes.`;
  record.output.sha256 = report.output.sha256;
}
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Approved ${ids.length} ${direction}-facing PG-024 prompt records.`);
