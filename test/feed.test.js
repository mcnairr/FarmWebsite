import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../api/src/cache.js';
import { loadConfig } from '../api/src/config.js';
import { createFlightFeed, createLimiter, routeIsPlausible } from '../api/src/feed.js';
import { createAppFromEnv } from '../api/src/handler.js';
import { fakeClock, fakeFetch, jsonResponse, quietLogger } from './helpers.js';

const FARM = { FARM_LATITUDE: '40.5', FARM_LONGITUDE: '-101.6' };
const DEN = { icao: 'KDEN', iata: 'DEN', city: 'Denver', name: 'Denver', latitude: 39.8617, longitude: -104.6732 };
const ORD = { icao: 'KORD', iata: 'ORD', city: 'Chicago', name: "O'Hare", latitude: 41.9786, longitude: -87.9048 };

/** Position at an offset (nm north / nm east) from the test farm. */
function position(id, overrides = {}, north = 0, east = 0) {
  return {
    id,
    callsign: null,
    registration: null,
    icaoType: 'B738',
    category: 'A3',
    latitude: 40.5 + north / 60,
    longitude: -101.6 + east / (60 * Math.cos((40.5 * Math.PI) / 180)),
    altitudeFt: 35000,
    onGround: false,
    groundSpeedKt: 450,
    headingDeg: 80,
    verticalRateFpm: 0,
    seenSeconds: 1,
    source: 'adsb_lol',
    ...overrides,
  };
}

function setup({ positions = [], routes = {}, routeImpl, env = {}, now = fakeClock() } = {}) {
  const config = loadConfig({ ...FARM, ...env });
  const calls = { positions: 0, routes: [] };
  const feed = createFlightFeed({
    config,
    cache: new TtlCache({ now }),
    logger: quietLogger,
    now,
    aircraftProvider: {
      source: 'adsb_lol',
      async getNearbyAircraft() {
        calls.positions++;
        if (positions instanceof Error) throw positions;
        return typeof positions === 'function' ? positions() : positions;
      },
    },
    routeProviders: [
      {
        lookupRoute:
          routeImpl ??
          (async (cs) => {
            calls.routes.push(cs);
            return routes[cs] ?? null;
          }),
      },
    ],
    aircraftInfoProvider: null,
  });
  return { feed, calls, now, config };
}

test('filters stale, grounded, distant and duplicate aircraft', async () => {
  const { feed } = setup({
    positions: [
      position('aaaaa1', { callsign: 'UAL1' }, 5, 0),
      position('aaaaa2', { seenSeconds: 120 }, 2, 0), // stale
      position('aaaaa3', { onGround: true, altitudeFt: 0 }, 1, 0), // on the ground
      position('aaaaa4', {}, 45, 0), // outside display radius
      position('aaaaa1', { callsign: 'UAL1', seenSeconds: 0.2 }, 6, 0), // duplicate, fresher
    ],
  });
  const res = await feed.getFeed();
  assert.equal(res.status, 'live');
  assert.deepEqual(res.aircraft.map((a) => a.id), ['aaaaa1']);
  assert.equal(res.aircraft[0].distanceFromFarmNm, 6, 'kept the fresher duplicate');
});

test('distance dominates ordering: a Cessna overhead beats a distant airliner', async () => {
  const { feed } = setup({
    positions: [
      position('jet001', { callsign: 'AAL2408' }, 0, 12),
      position('cessna', { callsign: 'N7351D', icaoType: 'C172', category: 'A1', altitudeFt: 4500, groundSpeedKt: 100 }, 0.5, 0.5),
      position('nocall', {}, 2, 0),
    ],
    routes: { AAL2408: { callsign: 'AAL2408', airline: 'American Airlines', airlineIcao: 'AAL', origin: DEN, destination: ORD } },
  });
  const res = await feed.getFeed();
  assert.deepEqual(res.aircraft.map((a) => a.id), ['cessna', 'nocall', 'jet001']);
  assert.equal(res.aircraft[0].aircraftClass, 'light');
  assert.equal(res.aircraft[0].aircraftType, 'Cessna 172 Skyhawk');
});

test('response follows the public contract with converted units', async () => {
  const { feed } = setup({
    positions: [position('a1b2c3', { callsign: 'AAL2408', registration: 'N123AA', groundSpeedKt: 430, headingDeg: 82 }, 2, -1)],
    routes: { AAL2408: { callsign: 'AAL2408', airline: 'American Airlines', airlineIcao: 'AAL', origin: DEN, destination: ORD } },
  });
  const [a] = (await feed.getFeed()).aircraft;
  assert.equal(a.callsign, 'AAL2408');
  assert.equal(a.airline, 'American Airlines');
  assert.equal(a.aircraftType, 'Boeing 737-800');
  assert.equal(a.groundSpeedMph, 495);
  assert.equal(a.groundSpeedKt, 430);
  assert.equal(a.routeKnown, true);
  assert.deepEqual(a.origin, { icao: 'KDEN', iata: 'DEN', city: 'Denver' });
  assert.deepEqual(a.destination, { icao: 'KORD', iata: 'ORD', city: 'Chicago' });
  assert.ok(a.routeProgress > 0.1 && a.routeProgress < 0.5, `progress ${a.routeProgress}`);
  assert.ok(Math.abs(a.distanceFromFarmNm - 2.2) < 0.15);
  assert.ok(a.directionFromFarmDeg > 320 && a.directionFromFarmDeg < 340);
  assert.equal(a.source, 'adsb_lol');
  // No internal or upstream-only fields leak out.
  assert.equal('seenSeconds' in a, false);
  assert.equal('squawk' in a, false);
});

test('database type that contradicts the broadcast category is dropped', async () => {
  // Seen live: a Delta jet at FL350 whose address mapped to a King Air.
  const { feed } = setup({ positions: [position('a65086', { callsign: 'DAL702', icaoType: 'BE20', registration: 'N514CJ', category: 'A3' }, 3, 0)] });
  const [a] = (await feed.getFeed()).aircraft;
  assert.equal(a.aircraftType, null);
  assert.equal(a.icaoType, null);
  assert.equal(a.registration, null);
  assert.equal(a.airline, 'Delta Air Lines');
});

test('unknown route: aircraft still shown, airline from callsign prefix, no route', async () => {
  const { feed } = setup({ positions: [position('abc001', { callsign: 'UAL1732' }, 3, 0)] });
  const [a] = (await feed.getFeed()).aircraft;
  assert.equal(a.airline, 'United Airlines');
  assert.equal(a.routeKnown, false);
  assert.equal(a.origin, null);
  assert.equal(a.destination, null);
  assert.equal(a.altitudeFt, 35000);
});

test('enrichment outage does not break the feed', async () => {
  const { feed } = setup({
    positions: [position('abc001', { callsign: 'UAL1732' }, 3, 0)],
    routeImpl: async () => {
      throw new Error('ADSBDB down');
    },
  });
  const res = await feed.getFeed();
  assert.equal(res.status, 'live');
  assert.equal(res.aircraft.length, 1);
  assert.equal(res.aircraft[0].routeKnown, false);
});

test('slow enrichment is skipped within budget and used on the next refresh', async () => {
  const now = fakeClock();
  let release;
  const gate = new Promise((r) => (release = r));
  const { feed } = setup({
    now,
    env: { FLIGHT_LIVE_CACHE_SECONDS: '10' },
    positions: [position('abc001', { callsign: 'AAL2408' }, 3, 0)],
    routeImpl: async (cs) => {
      await gate;
      return { callsign: cs, airline: 'American Airlines', airlineIcao: 'AAL', origin: DEN, destination: ORD };
    },
  });
  const started = Date.now();
  const first = await feed.getFeed();
  assert.ok(Date.now() - started < 3000, 'did not wait on the stalled lookup');
  assert.equal(first.aircraft[0].routeKnown, false);

  release();
  await new Promise((r) => setTimeout(r, 0));
  now.advance(11_000);
  const second = await feed.getFeed();
  assert.equal(second.aircraft[0].routeKnown, true);
});

test('position provider failure returns "unavailable" without throwing', async () => {
  const { feed } = setup({ positions: new Error('adsb.lol 503') });
  const res = await feed.getFeed();
  assert.equal(res.status, 'unavailable');
  assert.deepEqual(res.aircraft, []);
});

test('empty sky is a normal live response', async () => {
  const { feed } = setup({ positions: [] });
  const res = await feed.getFeed();
  assert.equal(res.status, 'live');
  assert.deepEqual(res.aircraft, []);
});

test('live snapshot is shared within its TTL and refreshed after', async () => {
  const now = fakeClock();
  const { feed, calls } = setup({ now, positions: [position('abc001', { callsign: 'UAL1' }, 3, 0)] });
  await Promise.all([feed.getFeed(), feed.getFeed(), feed.getFeed()]);
  assert.equal(calls.positions, 1, 'concurrent visitors coalesce onto one upstream request');
  now.advance(5_000);
  await feed.getFeed();
  assert.equal(calls.positions, 1, 'still cached');
  now.advance(6_000);
  await feed.getFeed();
  assert.equal(calls.positions, 2, 'refreshed after TTL');
});

test('routes are cached by callsign across snapshots (no N+1 per refresh)', async () => {
  const now = fakeClock();
  const { feed, calls } = setup({
    now,
    positions: [
      position('abc001', { callsign: 'UAL1' }, 3, 0),
      position('abc002', { callsign: 'AAL2' }, 4, 0),
      position('abc003', { callsign: 'N12345' }, 5, 0), // not an airline flight: never looked up
    ],
  });
  for (let i = 0; i < 5; i++) {
    await feed.getFeed();
    now.advance(15_000);
  }
  assert.deepEqual(calls.routes.sort(), ['AAL2', 'UAL1']);
});

test('implausible routes are rejected rather than shown', () => {
  const route = { callsign: 'SWA803', airline: 'Southwest Airlines', airlineIcao: 'SWA', origin: DEN, destination: ORD };
  const base = { ...position('x', { headingDeg: 80 }, 0, 0), distanceNm: 0, bearingDeg: 0 };
  assert.equal(routeIsPlausible(route, base), true, 'Nebraska is on the way from Denver to Chicago');
  assert.equal(routeIsPlausible(route, { ...base, headingDeg: 260 }), false, 'flying away from destination');
  const hawaii = { ...route, origin: { ...DEN, icao: 'PHOG', city: 'Kahului', latitude: 20.9, longitude: -156.43 }, destination: { ...ORD, icao: 'KOAK', city: 'Oakland', latitude: 37.72, longitude: -122.22 } };
  assert.equal(routeIsPlausible(hawaii, { ...base, headingDeg: 257 }), false, 'nowhere near the great circle');
  assert.equal(routeIsPlausible({ ...route, destination: null }, base), false, 'needs both ends');
});

test('limiter never runs more than N tasks at once', async () => {
  const run = createLimiter(2);
  let active = 0;
  let peak = 0;
  const task = () =>
    run(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
  await Promise.all(Array.from({ length: 10 }, task));
  assert.equal(peak, 2);
});

test('disabled feed returns status disabled without calling upstream', async () => {
  const { feed, calls } = setup({ env: { FLIGHT_FEED_ENABLED: 'false' }, positions: [position('abc001')] });
  const res = await feed.getFeed();
  assert.equal(res.status, 'disabled');
  assert.equal(calls.positions, 0);
});

test('demo mode labels data as demo and never calls real services', async () => {
  const fetchImpl = fakeFetch(() => {
    throw new Error('must not be called');
  });
  const app = createAppFromEnv({ FLIGHT_FEED_DEMO: 'true' }, { fetchImpl, logger: quietLogger });
  const body = await (await app.handle(new Request('http://localhost/api/flights'))).json();
  assert.equal(body.status, 'demo');
  assert.ok(body.aircraft.length >= 3);
  assert.ok(body.aircraft.every((a) => a.source === 'demo'));
  assert.equal(fetchImpl.calls.length, 0);

  const empty = await (await app.handle(new Request('http://localhost/api/flights?scenario=empty'))).json();
  assert.deepEqual(empty.aircraft, []);
  const outage = await (await app.handle(new Request('http://localhost/api/flights?scenario=outage'))).json();
  assert.equal(outage.status, 'unavailable');
});

test('demo mode is off by default and scenario params are ignored in live mode', async () => {
  assert.equal(loadConfig({}).demo, false);
  const fetchImpl = fakeFetch((url) => (url.includes('adsb') ? jsonResponse({ ac: [] }) : jsonResponse({}, 404)));
  const app = createAppFromEnv({}, { fetchImpl, logger: quietLogger });
  const body = await (await app.handle(new Request('http://localhost/api/flights?scenario=eight'))).json();
  assert.equal(body.status, 'live');
  assert.deepEqual(body.aircraft, []);
});

test('handler: CORS for allowed origins only, 404 for other paths, no stack traces', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ ac: [] }));
  const app = createAppFromEnv({}, { fetchImpl, logger: quietLogger });

  const allowed = await app.handle(new Request('http://x/api/flights', { headers: { origin: 'https://www.mcnair-farms.com' } }));
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://www.mcnair-farms.com');
  assert.match(allowed.headers.get('cache-control') ?? '', /max-age=10/);

  const other = await app.handle(new Request('http://x/api/flights', { headers: { origin: 'https://elsewhere.example' } }));
  assert.equal(other.headers.get('access-control-allow-origin'), null);

  const missing = await app.handle(new Request('http://x/api/secrets'));
  assert.equal(missing.status, 404);

  const post = await app.handle(new Request('http://x/api/flights', { method: 'POST' }));
  assert.equal(post.status, 405);

  const failing = createAppFromEnv({}, { fetchImpl: fakeFetch(() => jsonResponse({}, 500)), logger: quietLogger });
  const res = await failing.handle(new Request('http://x/api/flights'));
  const text = await res.text();
  assert.equal(JSON.parse(text).status, 'unavailable');
  assert.doesNotMatch(text, /Error|at \w+ \(/);
});

test('handler logs returned aircraft and Google SRE golden signals', async () => {
  const events = [];
  const logger = {
    info(event, fields) { events.push({ event, ...fields }); },
    warn() {},
    error() {},
  };
  const fetchImpl = fakeFetch(() => jsonResponse({ ac: [{
    hex: 'abc123', flight: 'UAL248', r: 'N78511', t: 'B738', category: 'A3',
    lat: 40.51, lon: -101.62, alt_baro: 24000, gs: 430, track: 80, seen_pos: 1,
  }] }));
  const app = createAppFromEnv({}, { fetchImpl, logger });

  const response = await app.handle(new Request('http://x/api/flights', { headers: { 'cf-ray': 'test-ray' } }));
  assert.equal(response.status, 200);

  const log = events.find((event) => event.event === 'http_response');
  assert.ok(log);
  assert.equal(log.request.cfRay, 'test-ray');
  assert.equal(log.response.aircraftCount, 1);
  assert.equal(log.aircraft[0].id, 'abc123');
  assert.equal(log.aircraft[0].registration, 'N78511');
  assert.deepEqual(Object.keys(log.goldenSignals).sort(), ['errors', 'latency', 'saturation', 'traffic']);
  assert.equal(log.goldenSignals.traffic.requests, 1);
  assert.equal(log.goldenSignals.errors.count, 0);
});

test('upstream outages produce structured application failure events', async () => {
  const warnings = [];
  const logger = {
    info() {},
    warn(component, message, fields) { warnings.push({ component, message, ...fields }); },
    error() {},
  };
  const app = createAppFromEnv({}, { fetchImpl: fakeFetch(() => jsonResponse({}, 503)), logger });

  const body = await (await app.handle(new Request('http://x/api/flights'))).json();
  assert.equal(body.status, 'unavailable');
  assert.equal(warnings[0].component, 'positions');
  assert.equal(warnings[0].provider, 'adsb_lol');
  assert.equal(warnings[0].upstreamStatus, 503);
});

test('farm coordinates come from env, with validated fallback', () => {
  assert.equal(loadConfig({ FARM_LATITUDE: '40.61', FARM_LONGITUDE: '-101.70' }).farm.latitude, 40.61);
  assert.equal(loadConfig({ FARM_LATITUDE: 'banana' }).farm.latitude, 40.5097);
  assert.equal(loadConfig({ FARM_LATITUDE: '123' }).farm.latitude, 40.5097);
  assert.equal(loadConfig({ FLIGHT_QUERY_RADIUS_NM: '999' }).queryRadiusNm, 50);
});
