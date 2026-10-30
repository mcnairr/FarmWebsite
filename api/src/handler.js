// @ts-check
// Web-standard request handler for the flight API. Runs unchanged on
// Cloudflare Workers (worker.js) and Node (scripts/dev-server.mjs).

import { TtlCache } from './cache.js';
import { loadConfig } from './config.js';
import { createFlightFeed } from './feed.js';
import { createStructuredLogger } from './observability.js';
import { createAdsbLolProvider } from './providers/adsb-lol.js';
import { createAdsbdbProvider } from './providers/adsbdb.js';
import { createDemoProviders, DEMO_SCENARIOS } from './providers/demo.js';

/**
 * Wire providers for the configured mode. Demo and live never mix: demo
 * mode swaps out every upstream provider.
 *
 * @param {import('./config.js').FeedConfig} config
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, logger?: { info?: (event: string, fields?: Record<string, unknown>) => void, warn: (key: string, message: string, fields?: Record<string, unknown>) => void, error?: (event: string, err: unknown, fields?: Record<string, unknown>) => void } }} [options]
 */
export function createApp(config, { fetchImpl, now = Date.now, logger = createStructuredLogger() } = {}) {
  const cache = new TtlCache({ now });
  /** @type {(promise: Promise<unknown>) => void} */
  let defer = () => {};

  let feed;
  if (config.demo) {
    const demo = createDemoProviders({ now });
    feed = createFlightFeed({
      config,
      cache,
      logger,
      now,
      aircraftProvider: {
        source: 'demo',
        getNearbyAircraft: async (lat, lon, _radius, { scenario } = {}) =>
          demo.positions(lat, lon, scenario && scenario in DEMO_SCENARIOS ? /** @type {any} */ (scenario) : 'default'),
      },
      routeProviders: [demo.routes],
      aircraftInfoProvider: null,
      defer: (p) => defer(p),
    });
  } else {
    const adsbdb = createAdsbdbProvider({ baseUrl: config.adsbdbBaseUrl, timeoutMs: config.enrichmentTimeoutMs, fetchImpl });
    feed = createFlightFeed({
      config,
      cache,
      logger,
      now,
      aircraftProvider: createAdsbLolProvider({ baseUrl: config.adsbLolBaseUrl, timeoutMs: config.positionTimeoutMs, fetchImpl }),
      // Future paid fallback (e.g. FlightAware AeroAPI) would be appended here,
      // reading its key from a server-side secret.
      routeProviders: [adsbdb],
      aircraftInfoProvider: adsbdb,
      defer: (p) => defer(p),
    });
  }

  /**
   * @param {Request} request
   * @param {{ waitUntil?: (promise: Promise<unknown>) => void }} [ctx]
   * @returns {Promise<Response>}
   */
  async function handle(request, ctx = {}) {
    const startedAt = now();
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('origin'), config.allowedOrigins);

    /** @param {Response} response @param {import('./types.js').FlightFeedResponse | null} [body] */
    function complete(response, body = null) {
      const durationMs = Math.max(0, now() - startedAt);
      const aircraft = body?.aircraft ?? [];
      const failed = response.status >= 500 || body?.status === 'unavailable';
      const responseBytes = Number(response.headers.get('content-length')) || null;
      logger.info?.('http_response', {
        request: {
          method: request.method,
          path: url.pathname,
          cfRay: request.headers.get('cf-ray'),
        },
        response: {
          statusCode: response.status,
          bytes: responseBytes,
          feedStatus: body?.status ?? null,
          aircraftCount: aircraft.length,
        },
        goldenSignals: {
          traffic: { requests: 1 },
          latency: { durationMs },
          errors: { count: failed ? 1 : 0, failed },
          saturation: {
            aircraftSlotsUsed: aircraft.length,
            aircraftSlotsLimit: config.maxDisplayedAircraft,
            aircraftSlotsRatio: config.maxDisplayedAircraft ? round(aircraft.length / config.maxDisplayedAircraft, 3) : 0,
          },
        },
        // These are the airplane records sent to the frontend. They contain
        // public ADS-B flight data, not visitor IPs, cookies, or user agents.
        aircraft,
      });
      return response;
    }

    if (request.method === 'OPTIONS') return complete(new Response(null, { status: 204, headers: cors }));
    if (url.pathname !== '/api/flights') return complete(json({ error: 'not found' }, 404, cors));
    if (request.method !== 'GET' && request.method !== 'HEAD') return complete(json({ error: 'method not allowed' }, 405, { ...cors, allow: 'GET, HEAD, OPTIONS' }));

    if (ctx.waitUntil) defer = (p) => ctx.waitUntil?.(p.catch(() => {}));
    try {
      const body = await feed.getFeed({ scenario: url.searchParams.get('scenario') ?? undefined });
      return complete(json(body, 200, { ...cors, 'cache-control': `public, max-age=${Math.min(config.liveCacheSeconds, 10)}` }), body);
    } catch (err) {
      logger.error?.('unhandled_request_failure', err, { request: { method: request.method, path: url.pathname } });
      logger.warn('handler', `unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      const body = { status: /** @type {const} */ ('unavailable'), aircraft: [] };
      return complete(json(body, 500, cors), /** @type {any} */ (body));
    }
  }

  return { handle, config };
}

/** @param {string | null} origin @param {readonly string[]} allowed */
function corsHeaders(origin, allowed) {
  /** @type {Record<string, string>} */
  const headers = { vary: 'Origin' };
  if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
    headers['access-control-max-age'] = '86400';
  }
  return headers;
}

/** @param {unknown} body @param {number} status @param {Record<string, string>} headers */
function json(body, status, headers) {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(new TextEncoder().encode(text).byteLength),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

/** @param {number} value @param {number} places */
function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Convenience for runtimes that hand over raw env strings. @param {Record<string, string | undefined>} env */
export function createAppFromEnv(env, options) {
  return createApp(loadConfig(env), options);
}
