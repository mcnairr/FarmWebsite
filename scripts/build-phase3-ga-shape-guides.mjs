import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../design/plane-art/shape-guides/', import.meta.url);
const sourceRoot = new URL('src/', root);
const inventoryUrl = new URL('inventory.json', root);

const guides = [
  ['sr20-sr22', 'SR20 / SR22', 'Low-wing four-seat piston single - fixed tricycle gear', { length: 1120, highWing: false, engines: 1, propellers: 1, gear: 'fixed', tail: 'conventional' }],
  ['bonanza-baron', 'Bonanza / Baron', 'Low-wing Beech piston family - retractable tricycle gear', { length: 1160, highWing: false, engines: 2, propellers: 2, gear: 'retractable', tail: 'v-tail' }],
  ['pc-12', 'PC-12', 'Large single-engine turboprop - low wing - tall T-tail', { length: 1280, highWing: false, engines: 1, propellers: 1, gear: 'retractable', tail: 't-tail', tall: true }],
  ['tbm-single-turboprop', 'TBM single turboprop', 'Fast compact single-engine turboprop - low wing - conventional tail', { length: 1190, highWing: false, engines: 1, propellers: 1, gear: 'retractable', tail: 'conventional' }],
  ['atr-72', 'ATR 72', 'High-wing regional twin turboprop - broad straight wing - T-tail', { length: 1400, highWing: true, engines: 2, propellers: 2, gear: 'retractable', tail: 't-tail', regional: true }],
  ['light-piston-twin', 'Light piston twin', 'Generic low-wing light twin - two piston nacelles - retractable gear', { length: 1110, highWing: false, engines: 2, propellers: 2, gear: 'retractable', tail: 'conventional' }],
];

function svg(title, description, o) {
  const x0 = (1600 - o.length) / 2;
  const x1 = x0 + o.length;
  const top = o.regional ? 365 : o.tall ? 380 : 395;
  const bottom = o.regional ? 475 : 468;
  const wingY = o.highWing ? top + 22 : bottom - 20;
  const wingSpan = o.regional ? 430 : 330;
  const wing = `<path d="M760 ${wingY} L${760 - wingSpan} 150 L${760 - wingSpan + 115} 132 L930 ${wingY + 12} Z"/><path d="M775 ${wingY + 10} L${775 - wingSpan} 745 L${775 - wingSpan + 105} 760 L930 ${wingY + 5} Z"/>`;
  const tail = o.tail === 't-tail'
    ? `<path d="M${x0 + 145} ${top + 12} L${x0 + 65} 180 L${x0 + 135} 168 L${x0 + 245} ${top + 15} Z"/><path d="M${x0 + 25} 178 L${x0 + 280} 178 L${x0 + 265} 205 L${x0 + 50} 205 Z"/>`
    : o.tail === 'v-tail'
      ? `<path d="M${x0 + 170} ${top + 22} L${x0 + 45} 220 L${x0 + 110} 205 L${x0 + 260} ${top + 22} Z"/><path d="M${x0 + 180} ${bottom - 8} L${x0 + 70} 655 L${x0 + 135} 666 L${x0 + 275} ${bottom - 12} Z"/>`
      : `<path d="M${x0 + 175} ${top + 15} L${x0 + 55} 215 L${x0 + 125} 202 L${x0 + 280} ${top + 18} Z"/>`;
  const engineXs = o.engines === 2 ? [650, 935] : [x1 - 80];
  const engines = engineXs.map((x) => `<ellipse cx="${x}" cy="${wingY + (o.highWing ? 55 : -12)}" rx="${o.regional ? 72 : 58}" ry="${o.regional ? 50 : 40}"/>`).join('');
  const props = engineXs.slice(0, o.propellers).map((x) => `<circle cx="${x + (o.engines === 1 ? 65 : 0)}" cy="${wingY + (o.highWing ? 55 : -12)}" r="${o.regional ? 90 : 75}" fill="none" stroke-width="10"/><line x1="${x + (o.engines === 1 ? 65 : 0)}" y1="${wingY + (o.highWing ? -35 : -87)}" x2="${x + (o.engines === 1 ? 65 : 0)}" y2="${wingY + (o.highWing ? 145 : 63)}" stroke-width="8"/>`).join('');
  const gear = o.gear === 'fixed' ? `<g fill="none" stroke-width="10"><line x1="680" y1="${bottom}" x2="660" y2="555"/><line x1="930" y1="${bottom}" x2="950" y2="555"/></g><circle cx="660" cy="570" r="22"/><circle cx="950" cy="570" r="22"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#fff"/><g fill="#132a46" stroke="#132a46" stroke-linejoin="round">
  <path d="M${x0} ${top + 35} C${x0 + 100} ${top - 12} ${x0 + 260} ${top - 18} ${x1 - 210} ${top - 2} C${x1 - 85} ${top + 5} ${x1 - 20} ${top + 28} ${x1} ${top + 55} C${x1 - 65} ${bottom - 2} ${x1 - 210} ${bottom + 2} ${x0 + 220} ${bottom} C${x0 + 85} ${bottom - 2} ${x0 + 20} ${bottom - 18} ${x0} ${top + 35} Z"/>${tail}${wing}${engines}${props}${gear}</g>
  <g fill="none" stroke="#6e7f92" stroke-width="5" stroke-dasharray="16 12"><line x1="70" y1="490" x2="1530" y2="490"/><line x1="800" y1="70" x2="800" y2="770"/></g>
  <g fill="#132a46" font-family="Arial, sans-serif"><text x="100" y="72" font-size="46" font-weight="700">${title} shape guide</text><text x="100" y="810" font-size="30">${description}</text><text x="100" y="852" font-size="25" fill="#52677d">Original McNair Farms project diagram - silhouette, engine count, propellers, and gear only.</text></g></svg>\n`;
}

await mkdir(sourceRoot, { recursive: true });
for (const [id, title, description, options] of guides) {
  const content = svg(title, description, options);
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
console.log(`Built and inventoried ${guides.length} original Phase 3 GA and turboprop shape guides.`);
