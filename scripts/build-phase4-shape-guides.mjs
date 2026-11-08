import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../design/plane-art/shape-guides/', import.meta.url);
const sourceRoot = new URL('src/', root);
const inventoryUrl = new URL('inventory.json', root);

const guides = [
  {
    id: 'cirrus-vision-jet-sf50',
    family: 'Cirrus Vision Jet SF50',
    title: 'Cirrus Vision Jet SF50',
    description: 'Compact single-engine personal jet - dorsal turbofan - low wing - forked V-tail',
    body: '<path d="M230 438 C360 382 570 372 1120 390 C1265 395 1360 420 1390 450 C1330 482 1195 492 410 484 C315 482 250 468 230 438 Z"/><path d="M725 425 L470 175 L555 165 L905 430 Z"/><path d="M750 450 L505 700 L590 716 L930 456 Z"/><ellipse cx="1120" cy="338" rx="118" ry="64"/><path d="M1210 408 L1390 220 L1340 205 L1160 405 Z"/><path d="M1210 472 L1395 648 L1342 668 L1160 475 Z"/>',
  },
  {
    id: 'cessna-citation-x',
    family: 'Cessna Citation X',
    title: 'Cessna Citation X',
    description: 'Long swept business jet - two rear fuselage turbofans - low swept wing - tall T-tail',
    body: '<path d="M175 438 C310 378 565 372 1260 392 C1370 397 1435 420 1460 449 C1388 482 1215 492 360 484 C265 482 198 466 175 438 Z"/><path d="M760 420 L420 130 L535 118 L1000 430 Z"/><path d="M785 452 L465 735 L575 748 L1020 458 Z"/><ellipse cx="1190" cy="372" rx="105" ry="55"/><ellipse cx="1190" cy="510" rx="105" ry="55"/><path d="M1220 410 L1370 165 L1310 150 L1140 410 Z"/><path d="M1240 210 L1450 182 L1432 225 L1230 250 Z"/>',
  },
];

function svg(guide) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#fff"/><g fill="#132a46" stroke="#132a46" stroke-linejoin="round">${guide.body}</g>
  <g fill="none" stroke="#6e7f92" stroke-width="5" stroke-dasharray="16 12"><line x1="70" y1="490" x2="1530" y2="490"/><line x1="800" y1="90" x2="800" y2="770"/></g>
  <g fill="#132a46" font-family="Arial, sans-serif"><text x="100" y="72" font-size="46" font-weight="700">${guide.title} shape guide</text><text x="100" y="810" font-size="30">${guide.description}</text><text x="100" y="852" font-size="25" fill="#52677d">Original McNair Farms project diagram - silhouette, engine count, placement, wing, and tail only.</text></g></svg>\n`;
}

await mkdir(sourceRoot, { recursive: true });
for (const guide of guides) {
  const content = svg(guide);
  await writeFile(new URL(`${guide.id}.svg`, sourceRoot), content);
  await sharp(Buffer.from(content)).png().toFile(fileURLToPath(new URL(`${guide.id}.png`, root)));
}

const inventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
for (const guide of guides) {
  const record = inventory.guides.find((candidate) => candidate.id === guide.id);
  if (!record) throw new Error(`Missing inventory record for ${guide.id}; rebuild the prompt catalog first.`);
  record.status = 'available';
  record.file = `design/plane-art/shape-guides/${guide.id}.png`;
  record.provenance = `Original project-authored technical silhouette rendered from design/plane-art/shape-guides/src/${guide.id}.svg on 2026-11-08.`;
  record.ownership = 'McNair Farms project';
  record.permission = 'Project-owned original; approved for use as a Vertex generation reference. No third-party input was used.';
  record.blockedTask = null;
}
await writeFile(inventoryUrl, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Built and inventoried ${guides.length} original Phase 4 shape guides.`);
