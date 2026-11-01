import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../design/plane-art/shape-guides/', import.meta.url);
const sourceRoot = new URL('src/', root);
const inventoryUrl = new URL('inventory.json', root);

const guides = [
  ['a350-747-class-widebody', 'A350 / 747-class widebody', 'Long twin-aisle fuselage - broad swept wing - large engine nacelles', { body: 'wide', engines: 2, wing: 'wide' }],
  ['777-a350-class-widebody', '777 / A350-class widebody', 'Long twin-aisle fuselage - raked tips - two large underwing engines', { body: 'wide-long', engines: 2, wing: 'wide' }],
  ['md-11-trijet', 'MD-11 trijet', 'Long cargo fuselage - two underwing engines - one tail-mounted center engine', { body: 'wide-long', engines: 3, wing: 'wide', tailEngine: true }],
  ['747-767-class-cargo-widebody', '747 / 767-class cargo widebody', 'Twin-engine freighter profile - broad fuselage - long swept wing - upper-deck shoulder cue', { body: 'wide', engines: 2, wing: 'wide', hump: true }],
  ['boeing-717-rear-engine-jet', 'Boeing 717 rear-engine jet', 'Compact narrow fuselage - T-tail - two rear-mounted engines', { body: 'short', engines: 2, rearEngines: true, tTail: true }],
  ['boeing-757-long-narrowbody', 'Boeing 757 long narrowbody', 'Long slender single-aisle fuselage - tall gear stance - two underwing engines', { body: 'narrow-long', engines: 2, wing: 'narrow' }],
  ['boeing-787-dreamliner', 'Boeing 787 Dreamliner', 'Twin-aisle fuselage - swept raked wing tips - two large chevron nacelles', { body: 'wide', engines: 2, wing: 'raked' }],
  ['boeing-777-widebody', 'Boeing 777 widebody', 'Very long twin-aisle fuselage - broad wing - two oversized underwing engines', { body: 'wide-long', engines: 2, wing: 'wide', bigEngines: true }],
  ['boeing-747-8-jumbo', 'Boeing 747-8 jumbo', 'Long jumbo fuselage - distinct forward upper-deck hump - four underwing engines', { body: 'wide-long', engines: 4, wing: 'wide', hump: true }],
  ['airbus-a380-super-jumbo', 'Airbus A380 super-jumbo', 'Deep full-length double-deck fuselage - very broad wing - four engines', { body: 'double-deck', engines: 4, wing: 'wide' }],
  ['airbus-a220', 'Airbus A220', 'Compact modern single-aisle fuselage - low swept wing - two geared-turbofan nacelles', { body: 'short', engines: 2, wing: 'narrow', bigEngines: true }],
  ['embraer-e190', 'Embraer E190', 'Long compact regional fuselage - low swept wing - two underwing engines', { body: 'regional-long', engines: 2, wing: 'narrow' }],
  ['bombardier-crj-200', 'Bombardier CRJ-200', 'Short slender regional fuselage - T-tail - two rear-mounted engines', { body: 'regional-short', engines: 2, rearEngines: true, tTail: true }],
  ['bombardier-crj-900', 'Bombardier CRJ-900', 'Long slender regional fuselage - T-tail - two rear-mounted engines', { body: 'regional-long', engines: 2, rearEngines: true, tTail: true }],
];

function svg(title, description, options) {
  const body = {
    short: [245, 1360, 354, 431], 'narrow-long': [145, 1455, 357, 426],
    wide: [125, 1480, 342, 448], 'wide-long': [85, 1515, 338, 452],
    'double-deck': [95, 1505, 315, 458], 'regional-short': [260, 1345, 365, 425],
    'regional-long': [185, 1420, 360, 430],
  }[options.body];
  const [nose, tail, top, bottom] = body;
  const depth = bottom - top;
  const hump = options.hump ? `<path d="M${tail - 430} ${top + 3} C${tail - 350} ${top - 65} ${tail - 235} ${top - 70} ${tail - 145} ${top + 12} Z"/>` : '';
  const secondDeck = options.body === 'double-deck' ? `<path fill="#fff" opacity=".2" d="M310 355 H1280 V370 H310 Z"/>` : '';
  const fin = options.tTail
    ? `<path d="M${nose + 125} ${top + 20} L${nose + 55} 178 L${nose + 125} 168 L${nose + 255} ${top + 23} Z"/><path d="M${nose + 30} 180 L${nose + 275} 180 L${nose + 260} 205 L${nose + 55} 205 Z"/>`
    : `<path d="M${nose + 155} ${top + 14} L${nose + 35} 150 L${nose + 120} 142 L${nose + 350} ${top + 16} Z"/>`;
  const wingTip = options.wing === 'raked' ? 920 : options.wing === 'wide' ? 965 : 855;
  const wing = `<path d="M690 ${top + 35} L385 112 L495 96 L${wingTip} ${top + 27} Z"/><path d="M735 ${bottom - 24} L430 714 L345 694 L590 ${bottom - 42} Z"/>`;
  const engineSize = options.bigEngines ? [105, 68] : depth > 100 ? [92, 58] : [68, 43];
  const engines = [];
  if (options.rearEngines) {
    engines.push(`<ellipse cx="${nose + 260}" cy="${bottom + 8}" rx="74" ry="38"/><ellipse cx="${nose + 390}" cy="${bottom + 9}" rx="74" ry="38"/>`);
  } else {
    const xs = options.engines === 4 ? [535, 690, 900, 1055] : [650, 950];
    engines.push(xs.map((x) => `<ellipse cx="${x}" cy="${bottom + 13}" rx="${engineSize[0]}" ry="${engineSize[1]}"/>`).join(''));
  }
  if (options.tailEngine) engines.push(`<path d="M${nose + 175} ${top + 10} L${nose + 265} 245 L${nose + 355} ${top + 17} Z"/><ellipse cx="${nose + 260}" cy="270" rx="56" ry="34"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#fff"/>
  <g fill="#132a46" stroke="#132a46" stroke-linejoin="round">
    <path d="M${nose} ${top + 38} C${nose + 115} ${top - 12} ${nose + 330} ${top - 22} ${tail - 300} ${top - 5} C${tail - 150} ${top} ${tail - 40} ${top + 35} ${tail} ${top + depth * .55} C${tail - 75} ${bottom - 5} ${tail - 220} ${bottom + 3} ${nose + 250} ${bottom} C${nose + 105} ${bottom - 3} ${nose + 25} ${bottom - 24} ${nose} ${top + 38} Z"/>
    ${hump}${fin}${wing}${engines.join('')}${secondDeck}
  </g>
  <g fill="none" stroke="#6e7f92" stroke-width="5" stroke-dasharray="16 12"><line x1="70" y1="490" x2="1530" y2="490"/><line x1="800" y1="70" x2="800" y2="725"/></g>
  <g fill="#132a46" font-family="Arial, sans-serif"><text x="100" y="72" font-size="46" font-weight="700">${title} shape guide</text><text x="100" y="790" font-size="30">${description} - gear retracted</text><text x="100" y="836" font-size="25" fill="#52677d">Original McNair Farms project diagram - silhouette and proportions only; no livery or registration reference.</text></g>
</svg>\n`;
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
  guide.provenance = `Original project-authored technical silhouette rendered from design/plane-art/shape-guides/src/${guide.id}.svg on 2026-11-01.`;
  guide.ownership = 'McNair Farms project';
  guide.permission = 'Project-owned original; approved for use as a Vertex generation reference. No third-party input was used.';
  guide.blockedTask = null;
}
await writeFile(inventoryUrl, `${JSON.stringify(inventory, null, 2)}\n`);

console.log(`Built and inventoried ${guides.length} original Phase 3 airliner shape guides.`);
