// @ts-check
// Pure, DOM-free logic for the homepage flight feed: selection, carousel
// stepping, display formatting, plane pose and sky placement. Kept separate
// from flight-feed.js so it can be unit tested in Node.

export { planeAsset, planeArtwork, planeFamily } from './plane-art.js';

/** @typedef {import('./api/src/types.js').NormalizedAircraft} Aircraft */

const number = new Intl.NumberFormat('en-US');

/**
 * Keep the user's selection across refreshes. If the selected aircraft has
 * left, move to the next aircraft after it in the previous ordering that is
 * still present, so the carousel doesn't jump back to #1.
 *
 * @param {string | null} selectedId
 * @param {string[]} previousIds  order shown before this refresh
 * @param {string[]} nextIds      order in the new data
 * @returns {string | null}
 */
export function reconcileSelection(selectedId, previousIds, nextIds) {
  if (nextIds.length === 0) return null;
  if (selectedId && nextIds.includes(selectedId)) return selectedId;
  const start = selectedId ? previousIds.indexOf(selectedId) : -1;
  if (start >= 0) {
    for (let i = 1; i < previousIds.length; i++) {
      const candidate = previousIds[(start + i) % previousIds.length];
      if (nextIds.includes(candidate)) return candidate;
    }
  }
  return nextIds[0];
}

/**
 * Step through the list with wraparound (1 → 2 → … → n → 1).
 * @param {string[]} ids @param {string | null} selectedId @param {number} delta
 */
export function stepSelection(ids, selectedId, delta) {
  if (ids.length === 0) return null;
  const index = selectedId ? ids.indexOf(selectedId) : -1;
  if (index < 0) return ids[0];
  return ids[(((index + delta) % ids.length) + ids.length) % ids.length];
}

/** @param {number | null} ft */
export function formatAltitude(ft) {
  return ft === null || ft === undefined ? null : `${number.format(Math.round(ft))} ft`;
}

/** @param {number | null} mph */
export function formatSpeed(mph) {
  return mph === null || mph === undefined ? null : `${number.format(Math.round(mph))} mph`;
}

/** @param {number} nm */
export function formatDistance(nm) {
  const miles = nm * 1.15078;
  return miles < 1 ? 'Overhead' : `${number.format(Math.round(miles))} mi`;
}

/** Mileage prefix for an origin or destination label. */
export function routeDistanceLabel(nm, direction) {
  if (nm === null || nm === undefined || !Number.isFinite(nm)) return direction;
  const miles = Math.max(0, Math.round(nm * 1.15078));
  return `${number.format(miles)} mi ${direction.toLowerCase()}`;
}

const COMPASS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];

// Four cardinal points plus all 12 compound points on a 16-point compass.
const COMPASS_ABBREVIATIONS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

/** @param {number} deg */
export function compassWord(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Short 16-point compass direction for a heading, such as SSE. @param {number} deg */
export function compassAbbreviation(deg) {
  return COMPASS_ABBREVIATIONS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Main label for an aircraft card. @param {Aircraft} a */
export function displayTitle(a) {
  return a.callsign ?? a.registration ?? 'Unidentified aircraft';
}

/**
 * Airport label: city prominent, code secondary. Never returns
 * placeholder text for missing values.
 * @param {Aircraft['origin']} airport
 */
export function airportLabel(airport) {
  if (!airport) return null;
  const code = airport.iata ?? airport.icao;
  const city = airport.city ?? code;
  if (!city) return null;
  return { city, code: code && code !== city ? code : null };
}

/** Whether to show a route row for this aircraft. @param {Aircraft} a */
export function hasRoute(a) {
  return a.routeKnown && !!airportLabel(a.origin) && !!airportLabel(a.destination);
}

/**
 * Side-view pose: face right for eastbound tracks, left for westbound, with
 * a slight nose-up/down tilt from vertical rate. Never rotates the
 * silhouette upside down.
 *
 * @param {number | null} headingDeg @param {number | null} verticalRateFpm
 * @returns {{ facing: 'left' | 'right', tiltDeg: number }}
 */
export function planePose(headingDeg, verticalRateFpm) {
  const facing = headingDeg !== null && headingDeg > 180 && headingDeg < 360 ? 'left' : 'right';
  const climb = Math.max(-5, Math.min(5, (verticalRateFpm ?? 0) / 400));
  // CSS rotation is clockwise; nose-up is counter-clockwise when facing right.
  const tiltDeg = Math.round((facing === 'right' ? -climb : climb) * 10) / 10;
  return { facing, tiltDeg: tiltDeg === 0 ? 0 : tiltDeg };
}

/**
 * Where the plane sits on the route line, kept clear of the city labels.
 * @param {number | null} progress
 */
export function routeLinePosition(progress) {
  return progress === null || progress === undefined ? 0.5 : 0.25 + Math.max(0, Math.min(1, progress)) * 0.5;
}

/**
 * Place unselected aircraft in the sky from their real position relative
 * to the farm (east → right, north → up), then push them out of the areas
 * occupied by the selected flight's card and route and spread out any that
 * overlap. Deterministic: the same data always yields the same layout.
 *
 * @param {Aircraft[]} aircraft
 * @param {{ width: number, height: number, radiusNm: number, avoid?: { left: number, top: number, right: number, bottom: number }[], pad?: number, spacing?: number }} area
 * @returns {Map<string, { x: number, y: number }>}
 */
export function placeTraffic(aircraft, { width, height, radiusNm, avoid = [], pad = 24, spacing = 44 }) {
  /** @type {Map<string, { x: number, y: number }>} */
  const out = new Map();
  if (width <= 0 || height <= 0) return out;
  const clampX = (x) => Math.max(pad, Math.min(width - pad, x));
  const clampY = (y) => Math.max(pad * 0.75, Math.min(height - pad * 0.75, y));
  /** @type {{ x: number, y: number }[]} */
  const placed = [];

  for (const a of [...aircraft].sort((p, q) => p.id.localeCompare(q.id))) {
    const r = Math.min(1, a.distanceFromFarmNm / Math.max(1, radiusNm));
    const theta = (a.directionFromFarmDeg * Math.PI) / 180;
    let x = clampX(width * (0.5 + 0.46 * r * Math.sin(theta)));
    let y = clampY(height * (0.5 - 0.44 * r * Math.cos(theta)));

    for (const box of avoid) {
      ({ x, y } = pushOutOf({ x, y }, box, r, pad, width, height));
    }

    for (const other of placed) {
      const dx = x - other.x;
      const dy = y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < spacing) {
        const ux = d === 0 ? 1 : dx / d;
        const uy = d === 0 ? 0 : dy / d;
        x = clampX(other.x + ux * spacing);
        y = clampY(other.y + uy * spacing);
      }
    }
    placed.push({ x, y });
    out.set(a.id, { x: Math.round(x), y: Math.round(y) });
  }
  return out;
}

/**
 * Move a point out of `box` (plus margin) through its nearest side that has
 * room, landing in the open band beyond it: aircraft farther from the farm
 * (`r` near 1) end up nearer the area's edge. Points outside the box are
 * returned unchanged.
 */
function pushOutOf(point, box, r, margin, width, height) {
  const vMargin = margin * 0.75;
  const left = box.left - margin;
  const right = box.right + margin;
  const top = box.top - vMargin;
  const bottom = box.bottom + vMargin;
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return point;
  const depth = 0.15 + 0.85 * r;
  const options = [
    { x: left - (left - margin) * depth, y: point.y, cost: point.x - left, ok: left >= margin },
    { x: right + (width - margin - right) * depth, y: point.y, cost: right - point.x, ok: right <= width - margin },
    { x: point.x, y: top - (top - vMargin) * depth, cost: point.y - top, ok: top >= vMargin },
    { x: point.x, y: bottom + (height - vMargin - bottom) * depth, cost: bottom - point.y, ok: bottom <= height - vMargin },
  ].filter((o) => o.ok);
  if (options.length === 0) return point;
  options.sort((a, b) => a.cost - b.cost);
  return { x: options[0].x, y: options[0].y };
}
