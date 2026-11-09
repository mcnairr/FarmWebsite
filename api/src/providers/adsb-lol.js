// @ts-check
// AircraftProvider backed by the public adsb.lol API (data under ODbL 1.0).
// This is the only module that understands adsb.lol's response schema.

import { fetchJson, UpstreamError } from '../http.js';
import * as clean from '../sanitize.js';

/** @typedef {import('../types.js').AircraftPosition} AircraftPosition */
/** @typedef {import('../types.js').RawAdsbAircraft} RawAdsbAircraft */

/**
 * @param {{ baseUrl: string, timeoutMs: number, fetchImpl?: typeof fetch }} options
 * @returns {import('../types.js').AircraftProvider}
 */
export function createAdsbLolProvider({ baseUrl, timeoutMs, fetchImpl }) {
  return {
    source: 'adsb_lol',
    async getNearbyAircraft(latitude, longitude, radiusNm) {
      const radius = Math.max(1, Math.min(250, Math.round(radiusNm)));
      const url = `${baseUrl}/v2/point/${latitude.toFixed(4)}/${longitude.toFixed(4)}/${radius}`;
      const { status, body } = await fetchJson('adsb.lol', url, { timeoutMs, fetchImpl });
      if (status === 404) throw new UpstreamError('adsb.lol', 'HTTP 404', 404);
      if (!clean.isObject(body) || !Array.isArray(body.ac)) {
        throw new UpstreamError('adsb.lol', 'unexpected response shape');
      }
      return body.ac.map(normalizeAdsbLolAircraft).filter((a) => a !== null);
    },
  };
}

/**
 * Convert one raw adsb.lol record to an AircraftPosition. Returns null when
 * the record lacks an identity or a usable position; every other field is
 * optional.
 *
 * @param {unknown} raw
 * @returns {AircraftPosition | null}
 */
export function normalizeAdsbLolAircraft(raw) {
  if (!clean.isObject(raw)) return null;
  /** @type {RawAdsbAircraft} */
  const ac = raw;
  const id = clean.hex(ac.hex);
  const latitude = clean.finite(ac.lat, -90, 90);
  const longitude = clean.finite(ac.lon, -180, 180);
  if (!id || latitude === null || longitude === null) return null;

  const onGround = ac.alt_baro === 'ground';
  const altitudeFt = onGround ? 0 : clean.finite(ac.alt_baro, -2000, 70000) ?? clean.finite(ac.alt_geom, -2000, 70000);
  const seen = clean.finite(ac.seen_pos, 0) ?? clean.finite(ac.seen, 0);

  return {
    id,
    callsign: clean.callsign(ac.flight),
    registration: clean.registration(ac.r),
    icaoType: clean.icaoType(ac.t),
    category: typeof ac.category === 'string' && /^[A-D][0-7]$/.test(ac.category) ? ac.category : null,
    latitude,
    longitude,
    altitudeFt,
    onGround,
    groundSpeedKt: clean.finite(ac.gs, 0, 1500),
    headingDeg: clean.finite(ac.track, 0, 360) ?? clean.finite(ac.true_heading, 0, 360),
    verticalRateFpm: clean.finite(ac.baro_rate, -20000, 20000) ?? clean.finite(ac.geom_rate, -20000, 20000),
    // A record with no age information can't be trusted as fresh.
    seenSeconds: seen ?? Infinity,
    source: 'adsb_lol',
  };
}
