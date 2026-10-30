// @ts-check
// Builds the normalized /api/flights response: fetch positions, filter and
// rank them around the farm, enrich with cached route/aircraft data, and
// shape the public contract. Provider-agnostic by design — a future farm
// receiver only needs to implement AircraftProvider.

import { bearingDeg, distanceNm, headingDifference, knotsToMph } from './geo.js';
import { aircraftClass, aircraftTypeName, airlineFromCallsign, looksLikeAirlineFlight } from './reference.js';

/** @typedef {import('./types.js').AircraftPosition} AircraftPosition */
/** @typedef {import('./types.js').FlightRoute} FlightRoute */
/** @typedef {import('./types.js').AircraftInfo} AircraftInfo */
/** @typedef {import('./types.js').Airport} Airport */
/** @typedef {import('./types.js').NormalizedAircraft} NormalizedAircraft */
/** @typedef {import('./types.js').FlightFeedResponse} FlightFeedResponse */
/** @typedef {import('./types.js').FeedStatus} FeedStatus */
/** @typedef {AircraftPosition & { distanceNm: number, bearingDeg: number }} Candidate */
/** @typedef {{ route: FlightRoute | null, failed?: boolean }} RouteEntry */
/** @typedef {{ info: AircraftInfo | null, failed?: boolean }} InfoEntry */

const HOUR = 3_600_000;
const NEGATIVE_ROUTE_TTL = HOUR;
const FAILURE_TTL = 2 * 60_000;

/**
 * @param {object} deps
 * @param {import('./config.js').FeedConfig} deps.config
 * @param {{ source: string, getNearbyAircraft: (lat: number, lon: number, radiusNm: number, options?: { scenario?: string }) => Promise<AircraftPosition[]> }} deps.aircraftProvider
 * @param {import('./types.js').RouteProvider[]} deps.routeProviders  tried in order until one knows the route
 * @param {import('./types.js').AircraftInfoProvider | null} deps.aircraftInfoProvider
 * @param {import('./cache.js').TtlCache} deps.cache
 * @param {{ info?: (event: string, fields?: Record<string, unknown>) => void, warn: (key: string, message: string, fields?: Record<string, unknown>) => void }} deps.logger
 * @param {(promise: Promise<unknown>) => void} [deps.defer]  keeps background enrichment alive (Workers ctx.waitUntil)
 * @param {() => number} [deps.now]
 */
export function createFlightFeed({ config, aircraftProvider, routeProviders, aircraftInfoProvider, cache, logger, defer = () => {}, now = Date.now }) {
  const limit = createLimiter(config.enrichmentConcurrency);

  /** @param {string} callsign @returns {Promise<RouteEntry>} */
  function routeFor(callsign) {
    return cache.getOrLoad(
      `route:${callsign}`,
      async () => {
        let failed = false;
        for (const provider of routeProviders) {
          try {
            const route = await limit(() => provider.lookupRoute(callsign));
            if (route) return { route };
          } catch (err) {
            failed = true;
            logger.warn('route', `route lookup failed: ${message(err)}`);
          }
        }
        return { route: null, failed };
      },
      (entry) => (entry.route ? config.routeCacheHours * HOUR : entry.failed ? FAILURE_TTL : NEGATIVE_ROUTE_TTL),
    );
  }

  /** @param {string} hex @returns {Promise<InfoEntry>} */
  function infoFor(hex) {
    const provider = aircraftInfoProvider;
    if (!provider) return Promise.resolve({ info: null });
    return cache.getOrLoad(
      `aircraft:${hex}`,
      async () => {
        try {
          return { info: await limit(() => provider.lookupAircraft(hex)) };
        } catch (err) {
          logger.warn('aircraft', `aircraft lookup failed: ${message(err)}`);
          return { info: null, failed: true };
        }
      },
      (entry) => (entry.failed ? FAILURE_TTL : config.aircraftCacheHours * HOUR),
    );
  }

  /**
   * Enrich candidates, waiting at most enrichmentBudgetMs. Slow lookups keep
   * running in the background and land in the cache for the next refresh.
   *
   * @param {Candidate[]} candidates
   */
  async function enrich(candidates) {
    const lookups = candidates.map((c) => {
      const route = c.callsign && looksLikeAirlineFlight(c.callsign) ? routeFor(c.callsign) : Promise.resolve({ route: null });
      const needsInfo = (!c.icaoType || !c.registration) && !c.id.startsWith('~') && c.source !== 'demo';
      const info = needsInfo ? infoFor(c.id) : Promise.resolve({ info: null });
      const both = Promise.all([route, info]);
      defer(both);
      return both;
    });

    let timer;
    const deadline = new Promise((resolve) => {
      timer = setTimeout(resolve, config.enrichmentBudgetMs, null);
    });
    try {
      return await Promise.all(lookups.map((l) => Promise.race([l, deadline])));
    } finally {
      clearTimeout(timer);
    }
  }

  /** @param {string | undefined} scenario @returns {Promise<FlightFeedResponse>} */
  async function build(scenario) {
    const { farm } = config;
    const snapshotAt = now();
    let positions;
    try {
      positions = await aircraftProvider.getNearbyAircraft(farm.latitude, farm.longitude, config.queryRadiusNm, { scenario });
    } catch (err) {
      logger.warn('positions', `aircraft positions unavailable: ${message(err)}`, {
        provider: aircraftProvider.source,
        upstreamStatus: errorStatus(err),
      });
      logger.info?.('flight_snapshot_built', {
        feedStatus: 'unavailable',
        provider: aircraftProvider.source,
        durationMs: Math.max(0, now() - snapshotAt),
        positionsReceived: 0,
        candidatesSelected: 0,
        aircraftReturned: 0,
      });
      return respond('unavailable', [], snapshotAt);
    }

    const candidates = selectCandidates(positions, config);
    const enrichment = await enrich(candidates);
    const aircraft = candidates
      .map((c, i) => {
        const [routeEntry, infoEntry] = enrichment[i] ?? [{ route: null }, { info: null }];
        return toPublicAircraft(c, routeEntry.route, infoEntry.info);
      })
      .sort((a, b) => relevanceScore(a) - relevanceScore(b) || a.id.localeCompare(b.id));

    const status = config.demo ? 'demo' : 'live';
    logger.info?.('flight_snapshot_built', {
      feedStatus: status,
      provider: aircraftProvider.source,
      durationMs: Math.max(0, now() - snapshotAt),
      positionsReceived: positions.length,
      candidatesSelected: candidates.length,
      aircraftReturned: aircraft.length,
      enrichmentLookups: candidates.length,
    });
    return respond(status, aircraft, snapshotAt);
  }

  /** @param {FeedStatus} status @param {NormalizedAircraft[]} aircraft @param {number} at */
  function respond(status, aircraft, at) {
    return {
      status,
      updatedAt: new Date(at).toISOString(),
      location: config.farm.name,
      displayRadiusNm: config.displayRadiusNm,
      refreshSeconds: config.refreshSeconds,
      aircraft,
    };
  }

  return {
    /**
     * Shared, cached feed. Concurrent visitors coalesce onto one build, and
     * one build is reused for liveCacheSeconds — including failures, so an
     * outage doesn't turn into a retry storm.
     *
     * @param {{ scenario?: string }} [options]  demo scenario; ignored outside demo mode
     * @returns {Promise<FlightFeedResponse>}
     */
    getFeed({ scenario } = {}) {
      if (!config.enabled) return Promise.resolve(respond('disabled', [], now()));
      const key = config.demo ? `feed:demo:${scenario ?? 'default'}` : 'feed:live';
      return cache.getOrLoad(key, () => build(config.demo ? scenario : undefined), () => config.liveCacheSeconds * 1000);
    },
  };
}

/**
 * Keep airborne, fresh, positioned aircraft inside the display radius, one
 * per ICAO address, ranked by a provisional score, capped at the display limit.
 *
 * @param {AircraftPosition[]} positions
 * @param {import('./config.js').FeedConfig} config
 * @returns {Candidate[]}
 */
export function selectCandidates(positions, config) {
  const { farm } = config;
  /** @type {Map<string, Candidate>} */
  const byId = new Map();
  for (const p of positions) {
    if (p.onGround || p.seenSeconds > config.staleAfterSeconds) continue;
    const dist = distanceNm(farm.latitude, farm.longitude, p.latitude, p.longitude);
    if (dist > config.displayRadiusNm) continue;
    const existing = byId.get(p.id);
    if (existing && existing.seenSeconds <= p.seenSeconds) continue;
    byId.set(p.id, { ...p, distanceNm: dist, bearingDeg: bearingDeg(farm.latitude, farm.longitude, p.latitude, p.longitude) });
  }
  return [...byId.values()]
    .sort((a, b) => provisionalScore(a) - provisionalScore(b) || a.id.localeCompare(b.id))
    .slice(0, config.maxDisplayedAircraft);
}

/**
 * Lower is better. Distance from the farm dominates (one point per nautical
 * mile), so a light aircraft directly overhead outranks a distant jet; a few
 * points reward complete, fresh, identifiable records.
 *
 * @param {{ distanceNm: number, callsign: string | null, altitudeFt: number | null, groundSpeedKt: number | null, seenSeconds: number }} a
 */
function provisionalScore(a) {
  return (
    a.distanceNm +
    (a.callsign ? 0 : 5) +
    (a.altitudeFt === null ? 3 : 0) +
    (a.groundSpeedKt === null ? 2 : 0) +
    (looksLikeAirlineFlight(a.callsign) ? -2 : 0) +
    Math.min(a.seenSeconds, 30) / 10
  );
}

/** Final ordering also gives a small bonus for a known route. @param {NormalizedAircraft} a */
export function relevanceScore(a) {
  return (
    provisionalScore({ ...a, distanceNm: a.distanceFromFarmNm, seenSeconds: a.dataAgeSeconds }) + (a.routeKnown ? -1.5 : 0)
  );
}

/**
 * @param {Candidate} c @param {FlightRoute | null} route @param {AircraftInfo | null} info
 * @returns {NormalizedAircraft}
 */
function toPublicAircraft(c, route, info) {
  let icaoType = c.icaoType ?? info?.icaoType ?? null;
  let registration = c.registration ?? info?.registration ?? null;
  // Type and registration come from database lookups by ICAO address, which
  // are occasionally wrong; the emitter category is broadcast by the
  // aircraft itself. A "large aircraft" transmitter can't be a light plane.
  if (icaoType && c.category && /^A[345]$/.test(c.category) && aircraftClass(null, icaoType) === 'light') {
    icaoType = null;
    registration = null;
  }
  const plausible = route ? routeIsPlausible(route, c) : false;
  const distances = plausible && route ? routeDistances(route, c) : null;
  const progress = distances && distances.fromOriginNm + distances.toDestinationNm > 0
    ? Math.min(1, Math.max(0, distances.fromOriginNm / (distances.fromOriginNm + distances.toDestinationNm)))
    : null;
  return {
    id: c.id,
    callsign: c.callsign,
    airline: route?.airline ?? airlineFromCallsign(c.callsign),
    registration,
    aircraftType: aircraftTypeName(icaoType, info),
    icaoType,
    aircraftClass: aircraftClass(c.category, icaoType),
    altitudeFt: c.altitudeFt === null ? null : Math.round(c.altitudeFt),
    groundSpeedKt: c.groundSpeedKt === null ? null : Math.round(c.groundSpeedKt),
    groundSpeedMph: c.groundSpeedKt === null ? null : Math.round(knotsToMph(c.groundSpeedKt)),
    headingDeg: c.headingDeg === null ? null : Math.round(c.headingDeg) % 360,
    verticalRateFpm: c.verticalRateFpm === null ? null : Math.round(c.verticalRateFpm),
    latitude: round(c.latitude, 3),
    longitude: round(c.longitude, 3),
    distanceFromFarmNm: round(c.distanceNm, 1),
    directionFromFarmDeg: Math.round(c.bearingDeg) % 360,
    origin: plausible && route ? publicAirport(route.origin) : null,
    destination: plausible && route ? publicAirport(route.destination) : null,
    routeKnown: plausible,
    routeProgress: progress === null ? null : round(progress, 2),
    distanceFromOriginNm: distances === null ? null : round(distances.fromOriginNm, 1),
    distanceToDestinationNm: distances === null ? null : round(distances.toDestinationNm, 1),
    dataAgeSeconds: Math.round(c.seenSeconds),
    source: c.source,
  };
}

/**
 * Callsign route databases go stale (callsigns get reused for other legs),
 * so only show a route the aircraft is plausibly flying: roughly on the
 * great circle between the airports and not heading away from the
 * destination. Better no route than a wrong one.
 *
 * @param {FlightRoute} route @param {Candidate} c
 */
export function routeIsPlausible(route, c) {
  const o = route.origin;
  const d = route.destination;
  if (!o || !d || !(o.city || o.iata || o.icao) || !(d.city || d.iata || d.icao)) return false;
  if (o.icao && o.icao === d.icao) return false;
  if (o.latitude === null || o.longitude === null || d.latitude === null || d.longitude === null) return true;

  const total = distanceNm(o.latitude, o.longitude, d.latitude, d.longitude);
  const toDest = distanceNm(c.latitude, c.longitude, d.latitude, d.longitude);
  const fromOrigin = distanceNm(o.latitude, o.longitude, c.latitude, c.longitude);
  if (total < 1) return false;
  if (fromOrigin + toDest > total * 1.3 + 75) return false;
  if (c.headingDeg !== null && toDest > 60) {
    const bearingToDest = bearingDeg(c.latitude, c.longitude, d.latitude, d.longitude);
    if (headingDifference(c.headingDeg, bearingToDest) > 100) return false;
  }
  return true;
}

/**
 * Great-circle mileage already flown from the origin and still remaining to
 * the destination. Airport coordinates stay server-side; only distances are
 * included in the public response.
 * @param {FlightRoute} route @param {Candidate} c
 * @returns {{ fromOriginNm: number, toDestinationNm: number } | null}
 */
function routeDistances(route, c) {
  const o = route.origin;
  const d = route.destination;
  if (!o || !d || o.latitude === null || o.longitude === null || d.latitude === null || d.longitude === null) return null;
  return {
    fromOriginNm: distanceNm(o.latitude, o.longitude, c.latitude, c.longitude),
    toDestinationNm: distanceNm(c.latitude, c.longitude, d.latitude, d.longitude),
  };
}

/** @param {Airport | null} a */
function publicAirport(a) {
  return a ? { icao: a.icao, iata: a.iata, city: a.city } : null;
}

/** Run at most `max` async tasks at once. @param {number} max */
export function createLimiter(max) {
  let active = 0;
  /** @type {(() => void)[]} */
  const queue = [];
  /**
   * @template T
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  return async function run(task) {
    // A finishing task hands its slot directly to the next waiter.
    if (active >= max) await new Promise((resolve) => queue.push(() => resolve(undefined)));
    else active++;
    try {
      return await task();
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  };
}

/** @param {number} n @param {number} places */
function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** @param {unknown} err */
function message(err) {
  return err instanceof Error ? err.message : String(err);
}

/** @param {unknown} err */
function errorStatus(err) {
  return err && typeof err === 'object' && 'status' in err && typeof err.status === 'number' ? err.status : null;
}
