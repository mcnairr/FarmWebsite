# McNair Farms Inc.

Family farm in Chase County, Nebraska. Static site hosted on GitHub Pages at
[www.mcnair-farms.com](https://www.mcnair-farms.com/).

The original `Oats.jpg` is retained unchanged for future high-resolution use.
Pages load responsive WebP derivatives from `assets/`: centered portrait crops
at 640 × 1280 and 1080 × 2160, and landscape versions at 1600 × 1200 and
2560 × 1920. These were generated with Sharp using quality 80 and effort 6.
The browser selects one image based on viewport shape, size, and pixel density.

Design references (such as the live flight tracker mockup) live in
`design/mockups/`.

## Live Flight Information Feed

### What visitors see

The homepage shows the aircraft actually flying near the farm right now,
drawn in the blue sky of the farm photograph:

- **The selected aircraft** uses a reviewed directional WebP (with the legacy
  jet or propeller SVG as a load-error fallback), facing its real direction of travel
  with a slight nose-up or nose-down tilt when climbing or descending.
- **Its route**, when known, runs through the plane: the origin city behind
  it, the destination ahead with an arrow (e.g. *From Denver DEN → To Chicago
  ORD*). The plane's position on the line reflects how far along the trip it is.
- **A glass card below the plane** shows the aircraft type, airline, flight number,
  tail number, altitude, speed in mph, and a 16-point heading such as **SSE (158°)**. A small line at the top gives
  its position, such as **● 15 MI NORTHEAST OF THE FARM**, plus the position,
  such as **2 OF 4**, when several aircraft are
  nearby.
- **‹ and › on the sides of the card** step to the previous or next aircraft,
  wrapping around. Arrow keys work while the card has focus, and on phones
  you can also swipe left or right across the sky. With one aircraft the
  arrows are hidden.
- **Other nearby aircraft** use the same reviewed directional WebPs as the
  selected aircraft, shown as small, faded planes placed by their real
  direction and distance from the farm (east to the right, north up). A failed
  image falls back to the matching legacy jet or propeller SVG. Clicking one
  selects it. Phones show the four most relevant; every aircraft is still
  reachable with ‹ ›.
- **No aircraft nearby, or a data outage:** the sky is left empty, with no
  message. The farm photo and title are never affected.

The footer gains a one-line data credit while the feed is on.

### How it works

```
 adsb.lol (live aircraft positions)        ADSBDB (routes, airlines, aircraft)
            │                                         │
            ▼                                         ▼
 ┌──────────────────────── Cloudflare Worker (api/) ────────────────────────┐
 │  fetch positions near the farm → filter & rank → look up routes (cached)  │
 │  → check routes are plausible → one shared JSON snapshot every 10 s       │
 └──────────────────────────────── GET /api/flights ────────────────────────┘
                                        │
                                        ▼
         www.mcnair-farms.com (GitHub Pages): flight-feed.js polls every 15 s
```

- **Visitors never contact the aviation services directly.** Their browsers
  ask only our `/api/flights`, so a hundred visitors still cause just one
  adsb.lol request every 10 seconds. adsb.lol also blocks requests made from
  web pages on other sites, so a small server piece is required either way.
- **GitHub Pages can't run server code**, so `/api/flights` runs as a
  Cloudflare Worker: a small program Cloudflare hosts for free and runs on
  demand. The website itself stays on GitHub Pages exactly as before.
- **Nothing to install or build in production.** The public site serves plain
  JavaScript, CSS, and 32 committed directional WebPs. The inline jet and
  propeller SVGs are load-error fallbacks. Google credentials, Vertex AI,
  billing, generation SDKs, and the development-only image tools are not
  needed to serve the approved aircraft library.
- **Data sources are pluggable.** Each source sits behind a small interface
  (`api/src/types.js`), and the browser only sees our own normalized JSON. A
  future receiver at the farm can replace or add to adsb.lol without any
  website changes (see the end of this section).

### External services

| Service | What it provides | Used by | Cost / account |
| --- | --- | --- | --- |
| [adsb.lol](https://www.adsb.lol/) | Live aircraft positions from volunteer ADS-B receivers: identity, callsign, position, altitude, speed, track | Worker, every 10 s at most | Free, no key. Data under the ODbL 1.0 license |
| [ADSBDB](https://www.adsbdb.com/) | Callsign → airline and origin/destination airports; aircraft address → type and registration | Worker, cached for hours | Free, no key |
| [Cloudflare Workers](https://workers.cloudflare.com/) | Hosts `/api/flights` | — | Free plan: 100,000 requests/day; account required |
| [GitHub Pages](https://pages.github.com/) | Hosts the website (unchanged) | — | Existing |

Neither aviation service publishes rate limits or uptime guarantees, which is
why everything is cached and every failure is handled gracefully. adsb.lol
offers optional API keys (adsb.lol/request) if they ever become necessary.

### Data behavior

- **Refresh:** browsers check for new data every 10 seconds. They pause in
  background tabs, refresh as soon as the visitor returns, and slow to once a
  minute while the service is having trouble.
- **Area:** the Worker requests everything within 50 nautical miles of the
  farm and shows up to 8 aircraft within 30 nm. Aircraft must be airborne and
  reported within the last 30 seconds. Duplicates are merged.
- **Which aircraft comes first:** closest to the farm, with small
  adjustments for completeness. A Cessna overhead outranks an airliner 12
  miles away. Scoring: 1 point per nautical mile; +5 no callsign, +3 no
  altitude, +2 no speed, −2 airline-style callsign, −1.5 known route, and up
  to +3 for older position reports. Lowest wins, with ties broken by aircraft
  address so the order is stable.
- **Selection is stable:** refreshes update the selected aircraft in place.
  If it leaves the area, the next one in line is selected; the view never
  jumps back to #1.
- **Units:** altitude in feet (`35,000 ft`). Speed is ground speed converted
  from knots to statute mph (× 1.15078), so it includes any tailwind.
- **Caching:**

  | Data | Kept for |
  | --- | --- |
  | Live position snapshot (shared by all visitors) | 10 s |
  | Route by callsign | 4 h when found, 1 h when unknown |
  | Aircraft details by address | 24 h |
  | Failed lookups | retried after 2 min |

  At most two ADSBDB lookups run at once. Routes are looked up only for
  airline-style callsigns. Aircraft details are looked up only when adsb.lol
  doesn't already provide them.
- **Speed over completeness:** adsb.lol gets 4 seconds and ADSBDB 2.5
  seconds to answer. `/api/flights` waits at most 1.5 seconds for route
  lookups, then answers without them; the routes appear on the next refresh.
- **Route accuracy:** route information is enrichment data and is often
  unavailable. Airlines reuse flight numbers, so the route database is
  frequently out of date; in testing it listed a Southwest flight over
  Nebraska as Kahului→Oakland. A route is shown only if the aircraft is
  plausibly flying it: near the direct path between the two airports and not
  heading away from the destination. Otherwise no route is shown. Routes are
  never guessed from heading.
- **Aircraft type accuracy:** the aircraft database occasionally mismatches.
  In testing a Delta jet at 35,000 ft came back as a Beechcraft King Air. When
  the database type contradicts the size class the aircraft itself
  broadcasts, the type and registration are left off.
- **Outages:** if adsb.lol fails, aircraft already on screen stay for up to
  45 seconds marked *Reconnecting…*, then the sky is left empty. If ADSBDB
  fails, aircraft still show, just without routes.
- **Privacy:** visitors' locations are never used; everything is relative to
  the farm. Nothing about visitors is logged. Server logs record only
  upstream failures, at most once per 5 minutes per kind.

### Going live (first-time setup)

The feature ships switched **off**. This line in `index.html` controls it:

```html
<meta name="flight-feed-endpoint" content="">
```

While `content` is empty, the homepage looks exactly as it always has. Going
live means putting the Worker online and then filling in that line with its
address. It takes about 10 minutes and costs nothing.

**What you need:** a free Cloudflare account and Node.js 20 or newer (check
with `node --version`). Nothing changes about your domain or DNS; they stay
with Google and GitHub.

1. **Create a Cloudflare account** at
   [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and
   verify your email. No credit card is required for the free plan.

2. **Log in from the terminal.** In this repository folder, run:

   ```sh
   npx wrangler@4 login
   ```

   `npx` downloads and runs Wrangler, Cloudflare's command-line tool. It runs
   on the fly; nothing is added to the project. `login` opens your browser
   and asks you to let Wrangler use your Cloudflare account. Click **Allow**,
   and the terminal confirms you're logged in. The login is saved in your
   Windows user profile, not in this repository.

3. **Deploy the Worker:**

   ```sh
   npm run deploy:api
   ```

   This is shorthand (defined in `package.json`) for
   `npx wrangler@4 deploy --config api/wrangler.toml`. It uploads the code in
   `api/src/` with the settings in `api/wrangler.toml` as a Worker named
   `mcnair-flight-feed`. The first time, Cloudflare asks you to choose a
   free `workers.dev` subdomain, such as `mcnairfarms`. If Wrangler doesn't
   prompt for one, set it in the Cloudflare dashboard under
   **Workers & Pages** and run the command again. When it finishes, it prints
   the Worker's address, for example:

   ```
   https://mcnair-flight-feed.mcnairfarms.workers.dev
   ```

4. **Check it works.** Open that address plus `/api/flights` in a browser.
   You should see JSON beginning `{"status":"live", …`. An empty `aircraft`
   list just means clear skies at the moment.

5. **(Optional) Use the farm's exact location** instead of the Imperial
   airport default. See [Changing the farm coordinates](#changing-the-farm-coordinates).

6. **Turn the feature on.** Put the address from step 3, plus
   `/api/flights`, into `index.html`:

   ```html
   <meta name="flight-feed-endpoint" content="https://mcnair-flight-feed.mcnairfarms.workers.dev/api/flights">
   ```

   Commit and push as usual. GitHub Pages publishes it within a minute or two.

7. **Visit www.mcnair-farms.com.** It shows ● LIVE with aircraft, or "Clear
   skies over McNair Farms".

### Day-to-day operations

| Task | How |
| --- | --- |
| Update the API after editing `api/` | `npm run deploy:api` again |
| Watch live server logs | `npx wrangler@4 tail --config api/wrangler.toml` |
| Search stored logs | Cloudflare dashboard → Workers & Pages → mcnair-flight-feed → Observability |
| Hide the feature immediately | Set `FLIGHT_FEED_ENABLED = "false"` in `api/wrangler.toml` and redeploy, or empty the `<meta>` content and push |
| Remove the Worker entirely | Empty the `<meta>` content and push, then `npx wrangler@4 delete --config api/wrangler.toml` |
| See usage | Cloudflare dashboard → Workers & Pages → mcnair-flight-feed |

**Usage limits:** the free plan allows 100,000 requests a day, about 400
hours of visitors with the page open. If that's ever exceeded, the sky stays
empty until the next day. The free plan never bills.

**Logging:** Workers Logs is enabled at 100% sampling. Each request stores an
invocation event plus a structured `http_response` event with the airplanes
sent to the browser and latency, traffic, error, and saturation fields. Feed
refreshes emit `flight_snapshot_built`, and each returned airplane emits an
`aircraft_observed` event with top-level airline, equipment, registration, and
aircraft identity fields for grouping in Workers Observability. Upstream and
application problems emit `application_failure`. The free plan currently
includes 200,000 log events per day with three-day retention. Cloudflare changes
this on December 1, 2026 to 0.5 GB ingested per day with seven-day retention.

**Custom address (optional):** a name like `flights.mcnair-farms.com` instead
of `workers.dev` requires the domain's DNS to move to Cloudflare. It's
currently on Google Cloud DNS. The `workers.dev` address works fine as-is.

### Configuration

Server settings live in `api/wrangler.toml` under `[vars]`; redeploy after
changing them. For local development, copy `.env.example` to `.env`. No API
keys are needed today. Any future key (e.g. `FLIGHTAWARE_API_KEY`) must be
stored as a Worker secret, never in the page or the repository.

| Variable | Default | Meaning |
| --- | --- | --- |
| `FLIGHT_FEED_ENABLED` | `true` | `false` hides the feature |
| `FLIGHT_FEED_DEMO` | `false` | Fictional flights for testing. Never on in production |
| `FARM_LATITUDE` / `FARM_LONGITUDE` | Imperial Municipal Airport | Set as secrets |
| `FLIGHT_QUERY_RADIUS_NM` | `50` | Search radius (max 250) |
| `FLIGHT_DISPLAY_RADIUS_NM` | `30` | Display radius |
| `FLIGHT_STALE_AFTER_SECONDS` | `30` | Ignore older position reports |
| `FLIGHT_REFRESH_SECONDS` | `10` | Browser refresh interval |
| `FLIGHT_LIVE_CACHE_SECONDS` | `10` | Shared snapshot lifetime |
| `FLIGHT_MAX_DISPLAYED` | `8` | Aircraft per snapshot |
| `FLIGHT_ALLOWED_ORIGINS` | `https://www.mcnair-farms.com,https://mcnair-farms.com` | Sites allowed to call the API |
| `ADSBLOL_BASE_URL` / `ADSBDB_BASE_URL` | public APIs | Override upstream addresses |

### Changing the farm coordinates

`api/src/config.js` defaults to Imperial Municipal Airport (KIML,
40.5097, −101.6208), a public landmark near the farm. To use the farm's
exact location without publishing it in this repository, store it as Worker
secrets:

```sh
npx wrangler@4 secret put FARM_LATITUDE --config api/wrangler.toml
npx wrangler@4 secret put FARM_LONGITUDE --config api/wrangler.toml
```

Each command prompts for the value; secrets take effect immediately. For
local development, put the values in `.env`, which git ignores. Because the
feed reports each aircraft's distance and bearing from the reference point,
that point can be approximately worked out from the data. A spot a mile or
two from the house works just as well for this feature.

### Local development

Requires Node.js 20+. No install step.

```sh
npm run demo   # fictional flights   → http://localhost:8080/
npm run dev    # real live data      → http://localhost:8080/
npm test       # unit tests
npm run test:browser # browser image loading, fallback, switching, caching, and layout tests
npm run test:all     # unit and browser suites
```

The browser suite uses Playwright Chromium. On a new machine, install its
browser once with `npx playwright install chromium` before running it.

In demo mode, preview edge cases by adding `?scenario=` with `empty`, `one`,
`two`, `four`, `eight`, `noroute` or `outage` to the page address. Demo data
is labelled ○ DEMO (never the green LIVE), is marked `source: "demo"`, and
replaces every real data source, so it can't mix with live data.

`npx wrangler@4 dev --config api/wrangler.toml` runs the Worker locally in
Cloudflare's own runtime, at http://127.0.0.1:8787/api/flights.

### Code layout

| Path | Purpose |
| --- | --- |
| `api/src/config.js` | Farm location and every tunable setting |
| `api/src/feed.js` | Filtering, ranking, route checks, enrichment, response shape |
| `api/src/providers/` | adsb.lol, ADSBDB and demo data sources |
| `api/src/cache.js` | Shared in-memory cache with request coalescing |
| `api/src/handler.js` | `GET /api/flights`, CORS, error handling |
| `api/src/worker.js`, `api/wrangler.toml` | Cloudflare Worker entry point and settings |
| `api/src/types.js` | Data shapes, including the public `/api/flights` contract |
| `flight-feed.js`, `flight-feed-model.js`, `flight-feed.css` | Homepage feature (CSS loads only when enabled) |
| `assets/planes/v1/manifest.js`, `design/plane-art/prompts.json` | Versioned plane-asset contract and development provenance |
| `design/plane-art/README.md` | Plane-art generation, review, processing, approval, replacement, validation, and archival runbook |
| `design/plane-art/phase1-release-baseline.md` | Released Phase 1 inventory and cold-cache behavior baseline |
| `design/plane-art/phase1-mobile-performance.md` | PG-017 throttled mobile measurements and shared-image decision |
| `scripts/process-plane-art.mjs` | Deterministic alpha cleanup, 960 × 330 normalization, WebP encoding, checks, and proof output |
| `scripts/repair-plane-lighting.mjs` | PG-011 reviewer-driven, alpha-preserving correction for smoke-like neutral upper-surface shading (`npm run plane-art:repair-lighting`) |
| `scripts/audit-phase1-plane-art.mjs` | Reproducible PG-011 dimensions, byte distribution, alpha, pair, model, and prompt-revision audit (`npm run plane-art:audit-phase1`) |
| `scripts/measure-plane-art-performance.mjs` | Repeatable throttled Chromium cold/warm benchmark (`npm run plane-art:measure-performance`) |
| `scripts/validate-plane-library.mjs` | CI-safe plane-library integrity, mapping, hostile-input, and public credential/runtime validation (`npm run plane-art:validate`) |
| `scripts/dev-server.mjs` | Local preview: website and API together |
| `test/` | Unit tests (`node --test`) |
| `design/mockups/` | Design references |

### Attribution and data licensing

- **adsb.lol** data is available under the
  [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  While the feed is on, the footer reads "Contains information from adsb.lol,
  made available under the ODbL."
- **ADSBDB** is credited in the footer. Its route data is the work of David
  Taylor and Jim Mason and may not be copied into other databases without
  permission. This site only looks routes up on demand and holds them
  briefly in memory; don't add permanent storage of route data.
- No third-party databases or aircraft photographs are stored here. Aircraft
  are rendered from reviewed, independently generated left/right WebPs. The
  original project-owned SVG shape guides document silhouettes, and the inline
  jet and propeller SVGs remain only as resilient load-error fallbacks.

### Future: a receiver at the farm

An inexpensive ADS-B receiver at the farm (an SDR dongle and antenna running
readsb or dump1090) publishes aircraft in the same family of formats adsb.lol
uses. Adding it means writing one new data source
(`api/src/providers/mcnair-receiver.js`) that returns aircraft marked
`source: "mcnair_receiver"`, and selecting it in `api/src/handler.js`. It can
be used alone or merged with adsb.lol, preferring the farm's own reports.
The website doesn't change, though it could then label those aircraft
"Received live at McNair Farms". A paid route source such as FlightAware
AeroAPI would plug in the same way, after ADSBDB, to fill in more routes.

Copyright © 2026 McNair Farms Inc. All rights reserved. See LICENSE.
