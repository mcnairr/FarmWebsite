// Local preview server: serves the static site and the flight API from one
// origin, so the homepage can be developed without deploying the Worker.
//
//   node scripts/dev-server.mjs           live data from adsb.lol / ADSBDB
//   node scripts/dev-server.mjs --demo    fictional demo flights
//   node scripts/dev-server.mjs --port 3000
//   http://localhost:8080/?scenario=eight  (demo mode: preview an edge case)
//
// Reads optional KEY=VALUE settings from .env (see .env.example).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createAppFromEnv } from '../api/src/handler.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || Number(process.env.PORT) || 8080;

const env = { ...readDotEnv(join(root, '.env')), ...process.env };
if (args.includes('--demo')) env.FLIGHT_FEED_DEMO = 'true';
const app = createAppFromEnv(env, { logger: { warn: (_key, message) => console.warn(`[flight-feed] ${message}`) } });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const response = await app.handle(new Request(url, { method: req.method, headers: toHeaders(req.headers) }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(/** @type {any} */ (response.body)).pipe(res);
      else res.end();
      return;
    }
    await serveStatic(url.pathname, res, url.searchParams.get('scenario'));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'text/plain' }).end('Internal error');
  }
});

server.listen(port, '127.0.0.1', () => {
  const mode = app.config.demo ? 'DEMO data' : 'live data';
  console.log(`McNair Farms preview: http://localhost:${port}/  (flight feed: ${mode})`);
  if (app.config.demo) console.log(`Demo scenarios: http://localhost:${port}/?scenario=empty|one|two|four|eight|noroute|outage`);
});

/**
 * @param {string} pathname @param {import('node:http').ServerResponse} res
 * @param {string | null} scenario  demo scenario requested via the page URL
 */
async function serveStatic(pathname, res, scenario) {
  let path = normalize(join(root, decodeURIComponent(pathname)));
  if (path !== root && !path.startsWith(root + sep)) return notFound(res);
  if (existsSync(path) && (await stat(path)).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path) || /[\\/]\.(git|env)/.test(path.slice(root.length))) return notFound(res);

  let body = await readFile(path);
  if (path.endsWith('index.html')) {
    // Point the page at this server's API; the committed page keeps its own
    // production setting.
    body = Buffer.from(
      body.toString('utf8').replace(/(<meta name="flight-feed-endpoint" content=")[^"]*(")/, `$1/api/flights${demoQuery(scenario)}$2`),
    );
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
}

/** In demo mode, http://localhost:8080/?scenario=four previews a demo scenario. @param {string | null} scenario */
function demoQuery(scenario) {
  return app.config.demo && scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
}

/** @param {import('node:http').ServerResponse} res */
async function notFound(res) {
  const page = await readFile(join(root, '404.html')).catch(() => Buffer.from('Not found'));
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end(page);
}

/** @param {import('node:http').IncomingHttpHeaders} incoming */
function toHeaders(incoming) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  return headers;
}

/** @param {string} file @returns {Record<string, string>} */
function readDotEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
