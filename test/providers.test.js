import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdsbLolProvider, normalizeAdsbLolAircraft } from '../api/src/providers/adsb-lol.js';
import { createAdsbdbProvider, parseAdsbdbRoute } from '../api/src/providers/adsbdb.js';
import { UpstreamError } from '../api/src/http.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const FULL_RECORD = {
  hex: 'AAA5AE', type: 'adsb_icao', flight: 'UAL248  ', r: 'N78511', t: 'B738',
  alt_baro: 24025, alt_geom: 24725, gs: 438.5, track: 78.02, baro_rate: 2176,
  category: 'A3', lat: 40.077164, lon: -103.428589, seen_pos: 0.063, seen: 0.1,
};

test('normalizes a complete adsb.lol record', () => {
  const a = normalizeAdsbLolAircraft(FULL_RECORD);
  assert.deepEqual(a, {
    id: 'aaa5ae',
    callsign: 'UAL248',
    registration: 'N78511',
    icaoType: 'B738',
    category: 'A3',
    latitude: 40.077164,
    longitude: -103.428589,
    altitudeFt: 24025,
    onGround: false,
    groundSpeedKt: 438.5,
    headingDeg: 78.02,
    verticalRateFpm: 2176,
    seenSeconds: 0.063,
    source: 'adsb_lol',
  });
});

test('missing optional fields become null instead of crashing', () => {
  const a = normalizeAdsbLolAircraft({ hex: 'abc123', lat: 40.5, lon: -101.6, seen: 2 });
  assert.ok(a);
  assert.equal(a.callsign, null);
  assert.equal(a.altitudeFt, null);
  assert.equal(a.groundSpeedKt, null);
  assert.equal(a.headingDeg, null);
  assert.equal(a.registration, null);
  assert.equal(a.seenSeconds, 2);
});

test('records without identity or position are dropped', () => {
  assert.equal(normalizeAdsbLolAircraft({ lat: 40, lon: -101 }), null);
  assert.equal(normalizeAdsbLolAircraft({ hex: 'abc123' }), null);
  assert.equal(normalizeAdsbLolAircraft({ hex: 'abc123', lat: 'x', lon: -101 }), null);
  assert.equal(normalizeAdsbLolAircraft(null), null);
  assert.equal(normalizeAdsbLolAircraft('nope'), null);
});

test('ground and garbage values are handled', () => {
  const a = normalizeAdsbLolAircraft({
    hex: 'abc123', lat: 40.5, lon: -101.6, alt_baro: 'ground', gs: -5, track: 999,
    flight: '<script>', r: 'N1 2', t: 'TOOLONG',
  });
  assert.ok(a);
  assert.equal(a.onGround, true);
  assert.equal(a.groundSpeedKt, null);
  assert.equal(a.headingDeg, null);
  assert.equal(a.callsign, null);
  assert.equal(a.registration, null);
  assert.equal(a.icaoType, null);
  assert.equal(a.seenSeconds, Infinity, 'no age information means not fresh');
});

test('adsb.lol provider builds the point URL and parses the list', async () => {
  const fetchImpl = fakeFetch((url) => {
    assert.equal(url, 'https://api.example/v2/point/40.5097/-101.6208/50');
    return jsonResponse({ ac: [FULL_RECORD, { junk: true }], msg: 'No error' });
  });
  const provider = createAdsbLolProvider({ baseUrl: 'https://api.example', timeoutMs: 1000, fetchImpl });
  const list = await provider.getNearbyAircraft(40.5097, -101.6208, 50);
  assert.equal(list.length, 1);
  assert.equal(list[0].callsign, 'UAL248');
});

test('adsb.lol failures surface as UpstreamError', async () => {
  for (const response of [
    () => jsonResponse({ error: 'x' }, 503),
    () => jsonResponse({ error: 'x' }, 429),
    () => new Response('<html>oops</html>', { status: 200 }),
    () => jsonResponse({ unexpected: true }),
  ]) {
    const provider = createAdsbLolProvider({ baseUrl: 'https://api.example', timeoutMs: 1000, fetchImpl: fakeFetch(response) });
    await assert.rejects(provider.getNearbyAircraft(40, -101, 50), UpstreamError);
  }
});

test('adsb.lol timeout rejects promptly', async () => {
  const hang = (_url, init) =>
    new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  const provider = createAdsbLolProvider({ baseUrl: 'https://api.example', timeoutMs: 30, fetchImpl: hang });
  const started = Date.now();
  await assert.rejects(provider.getNearbyAircraft(40, -101, 50), /timed out/);
  assert.ok(Date.now() - started < 1000);
});

const ADSBDB_ROUTE = {
  response: {
    flightroute: {
      callsign: 'UAL599', callsign_icao: 'UAL599', callsign_iata: 'UA599',
      airline: { name: 'United Airlines', icao: 'UAL', iata: 'UA', country: 'United States', callsign: 'UNITED' },
      origin: { iata_code: 'DEN', icao_code: 'KDEN', latitude: 39.8617, longitude: -104.673, municipality: 'Denver', name: 'Denver International Airport' },
      destination: { iata_code: 'EWR', icao_code: 'KEWR', latitude: 40.6925, longitude: -74.1687, municipality: 'New York', name: 'Newark Liberty International Airport' },
    },
  },
};

test('ADSBDB route response maps to FlightRoute', async () => {
  const fetchImpl = fakeFetch((url) => {
    assert.equal(url, 'https://db.example/v0/callsign/UAL599');
    return jsonResponse(ADSBDB_ROUTE);
  });
  const provider = createAdsbdbProvider({ baseUrl: 'https://db.example', timeoutMs: 1000, fetchImpl });
  const route = await provider.lookupRoute('UAL599');
  assert.deepEqual(route, {
    callsign: 'UAL599',
    airline: 'United Airlines',
    airlineIcao: 'UAL',
    origin: { icao: 'KDEN', iata: 'DEN', city: 'Denver', name: 'Denver International Airport', latitude: 39.8617, longitude: -104.673 },
    destination: { icao: 'KEWR', iata: 'EWR', city: 'New York', name: 'Newark Liberty International Airport', latitude: 40.6925, longitude: -74.1687 },
  });
});

test('ADSBDB unknown callsign (404) resolves to null', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ response: 'unknown callsign' }, 404));
  const provider = createAdsbdbProvider({ baseUrl: 'https://db.example', timeoutMs: 1000, fetchImpl });
  assert.equal(await provider.lookupRoute('ZZZ999'), null);
});

test('ADSBDB unknown aircraft (404) resolves to null', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({ response: 'unknown aircraft' }, 404));
  const provider = createAdsbdbProvider({ baseUrl: 'https://db.example', timeoutMs: 1000, fetchImpl });
  assert.equal(await provider.lookupAircraft('ffffff'), null);
});

test('ADSBDB server errors reject so they are not cached as "unknown"', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse({}, 500));
  const provider = createAdsbdbProvider({ baseUrl: 'https://db.example', timeoutMs: 1000, fetchImpl });
  await assert.rejects(provider.lookupRoute('UAL599'), UpstreamError);
});

test('route with missing airports or airline is still parsed safely', () => {
  assert.equal(parseAdsbdbRoute({}, 'ABC123'), null);
  const partial = parseAdsbdbRoute({ airline: { name: 'Mystery Air' }, origin: { municipality: 'Denver' } }, 'MYS1');
  assert.equal(partial?.airline, 'Mystery Air');
  assert.equal(partial?.origin?.city, 'Denver');
  assert.equal(partial?.destination, null);
});

test('ADSBDB text is sanitized', () => {
  const route = parseAdsbdbRoute(
    { airline: { name: 'Evil <img src=x> Air\u0007' }, origin: { municipality: 'Den\nver', iata_code: 'DENVER' } },
    'EVL1',
  );
  assert.equal(route?.airline, 'Evil img src=x Air');
  assert.equal(route?.origin?.city, 'Den ver');
  assert.equal(route?.origin?.iata, null);
});
