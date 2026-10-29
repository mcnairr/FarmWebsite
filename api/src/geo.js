// @ts-check

const EARTH_RADIUS_NM = 3440.065;
const MPH_PER_KNOT = 1.15078;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Great-circle distance in nautical miles (Haversine).
 * @param {number} lat1 @param {number} lon1 @param {number} lat2 @param {number} lon2
 */
export function distanceNm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Initial bearing from point 1 to point 2, degrees clockwise from true north.
 * @param {number} lat1 @param {number} lon1 @param {number} lat2 @param {number} lon2
 */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest absolute difference between two headings, 0–180. */
export function headingDifference(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** @param {number} knots */
export function knotsToMph(knots) {
  return knots * MPH_PER_KNOT;
}
