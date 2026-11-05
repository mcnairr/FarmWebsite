import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../design/plane-art/shape-guides/', import.meta.url);
const sourceRoot = new URL('src/', root);
const inventoryUrl = new URL('inventory.json', root);

const guides = [
  ['c-130-hercules', 'C-130 Hercules', 'High-wing tactical transport - four turboprops - broad cargo fuselage', 'c130'],
  ['c-17-globemaster', 'C-17 Globemaster', 'Heavy high-wing strategic transport - four turbofans - tall T-tail', 'c17'],
  ['kc-135-tanker', 'KC-135 tanker', 'Swept-wing four-engine tanker - narrow fuselage - refueling boom', 'kc135'],
];

function labels(title, description) {
  return `<g fill="none" stroke="#6e7f92" stroke-width="5" stroke-dasharray="16 12"><line x1="70" y1="490" x2="1530" y2="490"/><line x1="800" y1="70" x2="800" y2="735"/></g><g fill="#132a46" font-family="Arial, sans-serif"><text x="100" y="72" font-size="46" font-weight="700">${title} shape guide</text><text x="100" y="805" font-size="30">${description}</text><text x="100" y="850" font-size="25" fill="#52677d">Original McNair Farms project diagram - silhouette, engine count, tail, and role equipment only.</text></g>`;
}

function svg(title, description, kind) {
  const propellers = [560, 690, 910, 1040].map((x) => `<circle cx="${x}" cy="390" r="82" fill="none" stroke-width="10"/><line x1="${x}" y1="308" x2="${x}" y2="472" stroke-width="9"/>`).join('');
  const jetEngines = [555, 690, 910, 1045].map((x) => `<ellipse cx="${x}" cy="${kind === 'c17' ? 450 : 475}" rx="72" ry="48"/>`).join('');
  let aircraft;
  if (kind === 'c130') {
    aircraft = `<path d="M165 405 C300 360 430 350 1260 372 C1390 376 1450 410 1470 438 C1380 475 1160 480 315 475 C220 472 175 450 165 405 Z"/><path d="M350 390 L255 205 L340 190 L505 392 Z"/><path d="M620 385 L350 170 L455 150 L865 405 Z"/><path d="M655 445 L385 705 L280 685 L565 430 Z"/>${propellers}`;
  } else if (kind === 'c17') {
    aircraft = `<path d="M135 405 C275 340 455 335 1245 365 C1390 370 1460 405 1480 438 C1385 485 1110 495 300 480 C200 478 145 452 135 405 Z"/><path d="M330 390 L235 155 L330 142 L500 390 Z"/><path d="M220 160 L510 160 L500 195 L245 198 Z"/><path d="M650 390 L330 145 L455 125 L925 415 Z"/><path d="M685 450 L365 735 L245 715 L575 430 Z"/>${jetEngines}`;
  } else {
    aircraft = `<path d="M125 410 C260 365 430 355 1285 382 C1405 386 1460 414 1480 440 C1375 472 1110 478 295 470 C200 468 145 450 125 410 Z"/><path d="M315 395 L220 225 L300 210 L465 398 Z"/><path d="M690 400 L330 125 L460 110 L965 420 Z"/><path d="M720 445 L360 760 L235 735 L595 428 Z"/>${jetEngines}<path d="M300 458 L165 615 L205 625 L380 465 Z" fill="none" stroke-width="18"/><path d="M165 610 L130 650 L185 642 Z"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#fff"/><g fill="#132a46" stroke="#132a46" stroke-linejoin="round">${aircraft}</g>${labels(title, description)}</svg>\n`;
}

await mkdir(sourceRoot, { recursive: true });
for (const [id, title, description, kind] of guides) {
  const content = svg(title, description, kind);
  await writeFile(new URL(`${id}.svg`, sourceRoot), content);
  await sharp(Buffer.from(content)).png().toFile(fileURLToPath(new URL(`${id}.png`, root)));
}

const inventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const guideIds = new Set(guides.map(([id]) => id));
for (const guide of inventory.guides) {
  if (!guideIds.has(guide.id)) continue;
  guide.status = 'available';
  guide.file = `design/plane-art/shape-guides/${guide.id}.png`;
  guide.provenance = `Original project-authored technical silhouette rendered from design/plane-art/shape-guides/src/${guide.id}.svg on 2026-11-04.`;
  guide.ownership = 'McNair Farms project';
  guide.permission = 'Project-owned original; approved for use as a Vertex generation reference. No third-party input was used.';
  guide.blockedTask = null;
}
await writeFile(inventoryUrl, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Built and inventoried ${guides.length} original Phase 3 military shape guides.`);
