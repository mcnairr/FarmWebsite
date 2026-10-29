// @ts-check
// Central configuration for the live flight feed. Every value can be
// overridden with an environment variable (Worker vars/secrets, or
// process.env for the local Node server); see .env.example.

/**
 * Reference point for "aircraft near the farm".
 *
 * TEMPORARY: these defaults are Imperial Municipal Airport (KIML), a public
 * landmark a few miles from the farm. To use the exact farm location, set
 * FARM_LATITUDE / FARM_LONGITUDE as server-side secrets rather than editing
 * this file, so precise coordinates never land in the public repository.
 */
export const FARM_LOCATION = Object.freeze({
  name: 'McNair Farms',
  region: 'Chase County, Nebraska',
  latitude: 40.5097,
  longitude: -101.6208,
});

export const FLIGHT_CONFIG = Object.freeze({
  enabled: true,
  demo: false,
  /** Radius sent to adsb.lol (max 250). */
  queryRadiusNm: 50,
  /** Aircraft farther than this are not shown. */
  displayRadiusNm: 30,
  /** Position reports older than this are treated as stale tracks. */
  staleAfterSeconds: 30,
  /** How often browsers poll /api/flights. */
  refreshSeconds: 15,
  /** How long one upstream position snapshot is shared by all visitors. */
  liveCacheSeconds: 10,
  maxDisplayedAircraft: 8,
  /** Upstream request timeouts. Position data matters more than enrichment. */
  positionTimeoutMs: 4000,
  enrichmentTimeoutMs: 2500,
  /** Longest /api/flights will wait on enrichment before answering without it. */
  enrichmentBudgetMs: 1500,
  enrichmentConcurrency: 2,
  routeCacheHours: 4,
  aircraftCacheHours: 24,
  adsbLolBaseUrl: 'https://api.adsb.lol',
  adsbdbBaseUrl: 'https://api.adsbdb.com',
  allowedOrigins: ['https://www.mcnair-farms.com', 'https://mcnair-farms.com'],
});

/**
 * @typedef {object} FeedConfig
 * @property {boolean} enabled
 * @property {boolean} demo
 * @property {number} queryRadiusNm
 * @property {number} displayRadiusNm
 * @property {number} staleAfterSeconds
 * @property {number} refreshSeconds
 * @property {number} liveCacheSeconds
 * @property {number} maxDisplayedAircraft
 * @property {number} positionTimeoutMs
 * @property {number} enrichmentTimeoutMs
 * @property {number} enrichmentBudgetMs
 * @property {number} enrichmentConcurrency
 * @property {number} routeCacheHours
 * @property {number} aircraftCacheHours
 * @property {string} adsbLolBaseUrl
 * @property {string} adsbdbBaseUrl
 * @property {readonly string[]} allowedOrigins
 * @property {{ name: string, region: string, latitude: number, longitude: number }} farm
 */

/**
 * Build the effective configuration from environment variables.
 * Invalid or out-of-range values fall back to the defaults above.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {FeedConfig}
 */
export function loadConfig(env = {}) {
  const d = FLIGHT_CONFIG;
  return {
    ...d,
    enabled: bool(env.FLIGHT_FEED_ENABLED, d.enabled),
    demo: bool(env.FLIGHT_FEED_DEMO, d.demo),
    queryRadiusNm: num(env.FLIGHT_QUERY_RADIUS_NM, d.queryRadiusNm, 1, 250),
    displayRadiusNm: num(env.FLIGHT_DISPLAY_RADIUS_NM, d.displayRadiusNm, 1, 250),
    staleAfterSeconds: num(env.FLIGHT_STALE_AFTER_SECONDS, d.staleAfterSeconds, 5, 300),
    refreshSeconds: num(env.FLIGHT_REFRESH_SECONDS, d.refreshSeconds, 5, 300),
    liveCacheSeconds: num(env.FLIGHT_LIVE_CACHE_SECONDS, d.liveCacheSeconds, 1, 120),
    maxDisplayedAircraft: num(env.FLIGHT_MAX_DISPLAYED, d.maxDisplayedAircraft, 1, 20),
    adsbLolBaseUrl: url(env.ADSBLOL_BASE_URL, d.adsbLolBaseUrl),
    adsbdbBaseUrl: url(env.ADSBDB_BASE_URL, d.adsbdbBaseUrl),
    allowedOrigins: env.FLIGHT_ALLOWED_ORIGINS
      ? env.FLIGHT_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : d.allowedOrigins,
    farm: {
      ...FARM_LOCATION,
      latitude: num(env.FARM_LATITUDE, FARM_LOCATION.latitude, -90, 90),
      longitude: num(env.FARM_LONGITUDE, FARM_LOCATION.longitude, -180, 180),
    },
  };
}

/** @param {string | undefined} value @param {boolean} fallback */
function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

/** @param {string | undefined} value @param {number} fallback @param {number} min @param {number} max */
function num(value, fallback, min, max) {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** @param {string | undefined} value @param {string} fallback */
function url(value, fallback) {
  if (!value) return fallback;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin + u.pathname.replace(/\/$/, '') : fallback;
  } catch {
    return fallback;
  }
}
