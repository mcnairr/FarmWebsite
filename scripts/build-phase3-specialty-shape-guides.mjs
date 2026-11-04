import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../design/plane-art/shape-guides/', import.meta.url);
const sourceRoot = new URL('src/', root);
const inventoryUrl = new URL('inventory.json', root);

const guides = [
  ['thrush-crop-duster', 'Thrush crop duster', 'Purpose-built agricultural single - low wing - fixed gear - spray booms', 'crop', 1180],
  ['generic-crop-duster', 'Generic crop duster', 'Agricultural single - low wing - fixed gear - application equipment', 'crop', 1100],
  ['bell-206-helicopter', 'Bell 206 helicopter', 'Slender two-blade light helicopter - skid gear - conventional tail rotor', 'heli2', 1130],
  ['bell-407-helicopter', 'Bell 407 helicopter', 'Modern four-blade light helicopter - skid gear - conventional tail rotor', 'heli4', 1160],
  ['airbus-h135-helicopter', 'Airbus H135 helicopter', 'Twin-engine medical-class helicopter - skid gear - enclosed fenestron tail rotor', 'fenestron', 1200],
  ['light-helicopter', 'Light helicopter', 'Generic light utility helicopter - skid gear - conventional tail rotor', 'heli2', 1080],
];

function cropSvg(title, description, length) {
  const x0 = (1600 - length) / 2;
  const x1 = x0 + length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#fff"/><g fill="#132a46" stroke="#132a46" stroke-linejoin="round"><path d="M${x0} 410 C${x0 + 130} 360 ${x0 + 330} 350 ${x1 - 180} 370 C${x1 - 75} 380 ${x1 - 20} 410 ${x1} 440 C${x1 - 85} 474 ${x0 + 210} 485 ${x0} 455 Z"/><path d="M650 400 L285 205 L400 190 L935 405 Z"/><path d="M690 450 L335 700 L235 680 L555 440 Z"/><path d="M${x0 + 120} 405 L${x0 + 55} 225 L${x0 + 135} 220 L${x0 + 260} 405 Z"/><ellipse cx="${x1 - 35}" cy="430" rx="68" ry="52"/><circle cx="${x1 + 28}" cy="430" r="125" fill="none" stroke-width="10"/><line x1="${x1 + 28}" y1="305" x2="${x1 + 28}" y2="555" stroke-width="9"/><g fill="none" stroke-width="12"><line x1="670" y1="470" x2="640" y2="565"/><line x1="930" y1="468" x2="960" y2="565"/><line x1="405" y1="520" x2="1190" y2="520"/></g><circle cx="640" cy="584" r="25"/><circle cx="960" cy="584" r="25"/></g>${labels(title, description)}</svg>\n`;
}

function helicopterSvg(title, description, length, kind) {
  const x0 = (1600 - length) / 2;
  const x1 = x0 + length;
  const blades = kind === 'heli4' ? `<line x1="800" y1="235" x2="800" y2="535"/><line x1="650" y1="385" x2="950" y2="385"/>` : `<line x1="475" y1="385" x2="1125" y2="385"/>`;
  const tailRotor = kind === 'fenestron' ? `<circle cx="${x0 + 80}" cy="435" r="64" fill="#fff" stroke-width="20"/><circle cx="${x0 + 80}" cy="435" r="35"/>` : `<circle cx="${x0 + 65}" cy="425" r="72" fill="none" stroke-width="10"/><line x1="${x0 + 14}" y1="374" x2="${x0 + 116}" y2="476" stroke-width="9"/><line x1="${x0 + 14}" y1="476" x2="${x0 + 116}" y2="374" stroke-width="9"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#fff"/><g fill="#132a46" stroke="#132a46" stroke-linejoin="round"><path d="M${x0 + 235} 405 L${x0 + 35} 380 L${x0 + 20} 435 L${x0 + 300} 480 Z"/><path d="M${x0 + 245} 405 C${x0 + 345} 300 ${x1 - 235} 305 ${x1 - 100} 370 C${x1 - 15} 410 ${x1} 470 ${x1 - 55} 510 C${x1 - 175} 555 ${x0 + 365} 550 ${x0 + 250} 485 Z"/><path d="M${x0 + 70} 385 L${x0 + 125} 235 L${x0 + 190} 395 Z"/><rect x="770" y="350" width="60" height="55"/><g fill="none" stroke-width="12">${blades}<path d="M620 535 L585 615 L1000 615 L970 535"/><line x1="545" y1="615" x2="1040" y2="615"/></g>${tailRotor}</g>${labels(title, description)}</svg>\n`;
}

function labels(title, description) {
  return `<g fill="none" stroke="#6e7f92" stroke-width="5" stroke-dasharray="16 12"><line x1="70" y1="490" x2="1530" y2="490"/><line x1="800" y1="70" x2="800" y2="735"/></g><g fill="#132a46" font-family="Arial, sans-serif"><text x="100" y="72" font-size="46" font-weight="700">${title} shape guide</text><text x="100" y="805" font-size="30">${description}</text><text x="100" y="850" font-size="25" fill="#52677d">Original McNair Farms project diagram - silhouette, rotor/propeller, gear, and equipment only.</text></g>`;
}

await mkdir(sourceRoot, { recursive: true });
for (const [id, title, description, kind, length] of guides) {
  const content = kind === 'crop' ? cropSvg(title, description, length) : helicopterSvg(title, description, length, kind);
  await writeFile(new URL(`${id}.svg`, sourceRoot), content);
  await sharp(Buffer.from(content)).png().toFile(fileURLToPath(new URL(`${id}.png`, root)));
}

const inventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const guideIds = new Set(guides.map(([id]) => id));
for (const guide of inventory.guides) {
  if (!guideIds.has(guide.id)) continue;
  guide.status = 'available';
  guide.file = `design/plane-art/shape-guides/${guide.id}.png`;
  guide.provenance = `Original project-authored technical silhouette rendered from design/plane-art/shape-guides/src/${guide.id}.svg on 2026-11-03.`;
  guide.ownership = 'McNair Farms project';
  guide.permission = 'Project-owned original; approved for use as a Vertex generation reference. No third-party input was used.';
  guide.blockedTask = null;
}
await writeFile(inventoryUrl, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Built and inventoried ${guides.length} original Phase 3 crop-duster and helicopter shape guides.`);
