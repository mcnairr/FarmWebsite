// @ts-check
// Web-standard request handler for the flight API. Runs unchanged on
// Cloudflare Workers (worker.js) and Node (scripts/dev-server.mjs).

import { TtlCache } from './cache.js';
import { loadConfig } from './config.js';
import { createFlightFeed } from './feed.js';
import { createThrottledLogger } from './http.js';
import { createAdsbLolProvider } from './providers/adsb-lol.js';
import { createAdsbdbProvider } from './providers/adsbdb.js';
import { createDemoProviders, DEMO_SCENARIOS } from './providers/demo.js';

/**
 * Wire providers for the configured mode. Demo and live never mix: demo
 * mode swaps out every upstream provider.
 *
 * @param {import('./config.js').FeedConfig} config
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, logger?: { warn: (key: string, message: string) => void } }} [options]
 */
export function createApp(config, { fetchImpl, now = Date.now, logger = createThrottledLogger({ now }) } = {}) {
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
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('origin'), config.allowedOrigins);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== '/api/flights') return json({ error: 'not found' }, 404, cors);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method not allowed' }, 405, { ...cors, allow: 'GET, HEAD, OPTIONS' });

    if (ctx.waitUntil) defer = (p) => ctx.waitUntil?.(p.catch(() => {}));
    try {
      const body = await feed.getFeed({ scenario: url.searchParams.get('scenario') ?? undefined });
      return json(body, 200, { ...cors, 'cache-control': `public, max-age=${Math.min(config.liveCacheSeconds, 10)}` });
    } catch (err) {
      logger.warn('handler', `unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      return json({ status: 'unavailable', aircraft: [] }, 500, cors);
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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

/** Convenience for runtimes that hand over raw env strings. @param {Record<string, string | undefined>} env */
export function createAppFromEnv(env, options) {
  return createApp(loadConfig(env), options);
}
