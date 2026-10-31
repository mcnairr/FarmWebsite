// @ts-check
// Pure Phase 1 aircraft-art resolution. Every returned URL comes from the
// reviewed manifest; untrusted feed values are used only as allowlist keys.

import { PLANE_ASSETS } from './assets/planes/v1/manifest.js';

/** @typedef {import('./api/src/types.js').NormalizedAircraft} Aircraft */

const FAMILY_BY_ICAO = Object.freeze({
  // Regional jets.
  CRJ2: 'regional', CRJ7: 'regional', CRJ9: 'regional', CRJX: 'regional',
  E135: 'regional', E145: 'regional', E170: 'regional', E75L: 'regional',
  E75S: 'regional', E190: 'regional', E195: 'regional', E290: 'regional',

  // Single-aisle mainline aircraft.
  A220: 'narrowbody', A223: 'narrowbody',
  A319: 'narrowbody', A320: 'narrowbody', A321: 'narrowbody',
  B37M: 'narrowbody', B38M: 'narrowbody', B39M: 'narrowbody',
  B737: 'narrowbody', B738: 'narrowbody', B739: 'narrowbody',

  // Twin-aisle mainline and cargo aircraft.
  A332: 'widebody', A333: 'widebody', A338: 'widebody', A339: 'widebody',
  A359: 'widebody', A35K: 'widebody', B762: 'widebody', B763: 'widebody',
  B764: 'widebody', B772: 'widebody', B773: 'widebody', B77L: 'widebody',
  B77W: 'widebody', B778: 'widebody', B779: 'widebody', B788: 'widebody',
  B789: 'widebody', B78X: 'widebody',

  // Phase 1 business and special-aircraft families.
  C25A: 'bizjet-small', C25B: 'bizjet-small', C25C: 'bizjet-small',
  C510: 'bizjet-small', C525: 'bizjet-small', E50P: 'bizjet-small',
  E55P: 'bizjet-small',
  C150: 'cessna-high-wing', C152: 'cessna-high-wing',
  C172: 'cessna-high-wing', C182: 'cessna-high-wing', C206: 'cessna-high-wing',
  AT3P: 'air-tractor', AT5T: 'air-tractor', AT6T: 'air-tractor', AT8T: 'air-tractor',
});

const CLASS_FALLBACKS = Object.freeze({
  airliner: 'narrowbody',
  light: 'cessna-high-wing',
  other: 'bizjet-small',
});

const BRANDED_FAMILIES = Object.freeze({
  AAL: Object.freeze({ narrowbody: 'aal-narrowbody', widebody: 'aal-widebody' }),
  UAL: Object.freeze({ narrowbody: 'ual-narrowbody', widebody: 'ual-widebody' }),
  DAL: Object.freeze({ narrowbody: 'dal-narrowbody', widebody: 'dal-widebody' }),
  SWA: Object.freeze({ narrowbody: 'swa-narrowbody' }),
  FDX: Object.freeze({ widebody: 'fdx-widebody' }),
  UPS: Object.freeze({ widebody: 'ups-widebody' }),
  ASA: Object.freeze({ narrowbody: 'asa-narrowbody' }),
  JBU: Object.freeze({ narrowbody: 'jbu-narrowbody' }),
  FFT: Object.freeze({ narrowbody: 'fft-narrowbody' }),
  NKS: Object.freeze({ narrowbody: 'nks-narrowbody' }),
  AAY: Object.freeze({ narrowbody: 'aay-narrowbody' }),
  SCX: Object.freeze({ narrowbody: 'scx-narrowbody' }),
  HAL: Object.freeze({ narrowbody: 'hal-narrowbody', widebody: 'hal-widebody' }),
  ACA: Object.freeze({ narrowbody: 'aca-narrowbody', widebody: 'aca-widebody' }),
  WJA: Object.freeze({ narrowbody: 'wja-narrowbody' }),
  AMX: Object.freeze({ narrowbody: 'amx-narrowbody' }),
  VOI: Object.freeze({ narrowbody: 'voi-narrowbody' }),
});

const REGIONAL_PARTNERS = Object.freeze({
  ENY: 'american-eagle-regional',
  JIA: 'american-eagle-regional',
});

const SPECIAL_ARTWORK = Object.freeze({
  'bizjet-small': 'generic-bizjet-small',
  'cessna-high-wing': 'cessna-high-wing',
  'air-tractor': 'air-tractor-yellow',
});

const GENERIC_ARTWORK = Object.freeze({
  regional: 'generic-regional',
  narrowbody: 'generic-narrowbody',
  widebody: 'generic-widebody',
  'bizjet-small': 'generic-bizjet-small',
  'cessna-high-wing': 'cessna-high-wing',
  'air-tractor': 'air-tractor-yellow',
});

const ASSET_BY_KEY = new Map(PLANE_ASSETS.map((asset) => [asset.key, asset]));
const ARTWORK_IDS = new Set(PLANE_ASSETS.map((asset) => asset.artworkId));
const RIGHT = 'right';
const DEFAULT_ARTWORK = 'generic-narrowbody';

/** Normalize an ICAO designator without ever treating it as a path fragment. */
function normalizedIcao(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,4}$/.test(normalized) ? normalized : null;
}

/** Return an authored three-letter operator prefix from a valid callsign. */
function callsignPrefix(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}[A-Z0-9]{1,5}$/.test(normalized)) return null;
  return normalized.slice(0, 3);
}

/**
 * Resolve an ICAO designator to a Phase 1 visual family. Unknown types use
 * the normalized public aircraft class, then the existing default jet family.
 *
 * @param {unknown} icaoType
 * @param {unknown} aircraftClass
 * @returns {string}
 */
export function planeFamily(icaoType, aircraftClass) {
  const icao = normalizedIcao(icaoType);
  if (icao && FAMILY_BY_ICAO[icao]) return FAMILY_BY_ICAO[icao];
  return typeof aircraftClass === 'string' && CLASS_FALLBACKS[aircraftClass]
    ? CLASS_FALLBACKS[aircraftClass]
    : 'narrowbody';
}

/**
 * Select a reviewed Phase 1 artwork ID using the documented precedence.
 *
 * @param {Partial<Aircraft> | null | undefined} aircraft
 * @returns {string}
 */
export function planeArtwork(aircraft) {
  const candidate = aircraft && typeof aircraft === 'object' ? aircraft : {};
  const icao = normalizedIcao(candidate.icaoType);
  const prefix = callsignPrefix(candidate.callsign);
  const family = planeFamily(icao, candidate.aircraftClass);

  // 1. Exact airline/cargo brand plus a manifest-approved ICAO type.
  if (icao && prefix && BRANDED_FAMILIES[prefix]) {
    const brandedId = BRANDED_FAMILIES[prefix][family];
    const asset = brandedId && ASSET_BY_KEY.get(`${brandedId}:${RIGHT}`);
    if (asset?.applicableIcaoTypes.includes(icao)) return brandedId;
  }

  // 2. A regional brand is safe only for a reviewed operating partnership.
  if (family === 'regional' && prefix && REGIONAL_PARTNERS[prefix]) {
    const regionalId = REGIONAL_PARTNERS[prefix];
    const asset = ASSET_BY_KEY.get(`${regionalId}:${RIGHT}`);
    if (icao && asset?.applicableIcaoTypes.includes(icao)) return regionalId;
  }

  // 3. Exact special-aircraft family.
  if (icao && SPECIAL_ARTWORK[family]) return SPECIAL_ARTWORK[family];

  // 4. The closest branded treatment is allowed only inside the same family.
  if (prefix && BRANDED_FAMILIES[prefix]?.[family]) {
    return BRANDED_FAMILIES[prefix][family];
  }

  // 5. Generic/special-neutral family fallback. The legacy SVG is reserved
  // for the image element's load-error handler and is never selected here.
  return GENERIC_ARTWORK[family] ?? DEFAULT_ARTWORK;
}

/**
 * Look up one independent directional manifest record. Invalid inputs fall
 * back to a reviewed generic record and can never affect the returned URL.
 *
 * @param {unknown} artworkId
 * @param {unknown} direction
 * @returns {(typeof PLANE_ASSETS)[number]}
 */
export function planeAsset(artworkId, direction) {
  const safeDirection = direction === 'left' ? 'left' : RIGHT;
  const safeArtworkId = typeof artworkId === 'string' && ARTWORK_IDS.has(artworkId)
    ? artworkId
    : DEFAULT_ARTWORK;
  return ASSET_BY_KEY.get(`${safeArtworkId}:${safeDirection}`)
    ?? ASSET_BY_KEY.get(`${DEFAULT_ARTWORK}:${safeDirection}`);
}

