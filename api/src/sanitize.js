// @ts-check
// Validation helpers for untrusted upstream data. Anything that fails
// validation becomes null rather than reaching the browser.

/** @param {unknown} value @param {number} min @param {number} max */
export function finite(value, min = -Infinity, max = Infinity) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** Plain display text: printable characters only, collapsed whitespace, bounded length. */
export function text(value, maxLength = 80) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

/** ICAO 24-bit address. adsb.lol prefixes non-ICAO (e.g. TIS-B) addresses with "~". */
export function hex(value) {
  if (typeof value !== 'string') return null;
  const h = value.trim().toLowerCase();
  return /^~?[0-9a-f]{6}$/.test(h) ? h : null;
}

/** Flight callsign: 2–8 letters/digits after trimming the ADS-B space padding. */
export function callsign(value) {
  if (typeof value !== 'string') return null;
  const c = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(c) ? c : null;
}

export function registration(value) {
  if (typeof value !== 'string') return null;
  const r = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{0,9}$/.test(r) ? r : null;
}

/** ICAO type designator, e.g. B738, C172. */
export function icaoType(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,4}$/.test(t) ? t : null;
}

/** Airport code of a given length (3 for IATA, 4 for ICAO). */
export function airportCode(value, length) {
  if (typeof value !== 'string') return null;
  const c = value.trim().toUpperCase();
  return c.length === length && /^[A-Z0-9]+$/.test(c) ? c : null;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
