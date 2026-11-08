import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ids = ['cirrus-vision-jet', 'citation-x'];
const direction = process.argv[2];
if (!['right', 'left'].includes(direction)) throw new Error('Pass right or left.');

const rejectedRight = {
  'cirrus-vision-jet': 'The first right request 6d8bf811685847d5b483 was rejected for wrong direction and missing credible cockpit anatomy.',
  'citation-x': 'The first right request 62f95d67aa6bdf614617 was rejected for four engines and duplicated wing/tail anatomy.',
};

const catalogPath = resolve('design/plane-art/prompts.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
for (const id of ids) {
  const record = catalog.records.find((item) => item.key === `${id}:${direction}:v1`);
  if (!record) throw new Error(`Missing prompt record for ${id}:${direction}.`);
  const report = JSON.parse(await readFile(resolve(`.generated/plane-art/processed/${id}-${direction}.json`), 'utf8'));
  const metadata = JSON.parse(await readFile(resolve(`.generated/plane-art/candidates/${id}/${direction}/${report.source.requestKey}/metadata.json`), 'utf8'));
  record.status = 'approved';
  record.generatedAt = metadata.requestTime;
  record.candidateNotes = `Vertex request ${report.source.requestKey} returned one independently generated ${direction}-facing PG-027 candidate on uniform magenta; processed with deterministic global chroma extraction at distance 120. Manual-repair SHA-256: ${report.source.manualRepair.sha256}.${direction === 'right' ? ` ${rejectedRight[id]}` : ''}`;
  record.approvalNotes = `Approved 2026-11-08 for PG-027 after production-sky and checkerboard review at 272 px hero and 46 px blip sizes: direction, exact SF50/Citation X silhouette, engine count and placement, wing/tail anatomy, retracted gear, neutral private identity, crop, baseline, alpha edges, and pair recognition pass. Output is ${report.output.bytes} bytes; the dated reviewed below-range exception is recorded in the processing report.`;
  record.output.sha256 = report.output.sha256;
}
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Approved ${ids.length} ${direction}-facing PG-027 prompt records.`);
