# McNair Farms Website v1.0.0

The first stable release of the McNair Farms website pairs a fast, responsive
farm homepage with a live view of aircraft flying near the farm in Chase
County, Nebraska.

## Highlights

- Responsive, static GitHub Pages site with landscape and portrait WebP farm
  photography, custom-domain support, favicon, analytics, and a custom 404
  page.
- Live nearby-aircraft feed backed by a Cloudflare Worker. The browser receives
  a shared, normalized snapshot rather than contacting aviation providers
  directly.
- Rich flight cards with route, airline and flight number, aircraft type, tail
  number, altitude, ground speed, compass heading, distance, and position in the
  current nearby-aircraft set when those fields are available.
- Mouse, keyboard, touch, and timed-carousel navigation between nearby flights,
  including stable selection across refreshes and clear loading, empty, and
  reconnecting states.
- Clickable background traffic placed by real bearing and distance, with
  demand-driven image loading and SVG fallbacks.

## Aircraft artwork library

v1 ships 76 reviewed aircraft treatments as 152 independently generated left-
and right-facing transparent WebPs. The resolver selects artwork from trusted,
authored mappings for airline, aircraft family, and exact type, then falls back
through compatible generic silhouettes. Runtime feed strings never become asset
paths.

The library covers major North American and international passenger airlines,
regional partners, cargo operators, business jets, general aviation,
turboprops, agricultural aircraft, helicopters, and neutral military types.
An evidence-based follow-up using 5,829 retained observation events from 374
distinct aircraft added exact Cirrus Vision Jet (`SF50`) and Cessna Citation X
(`C750`) treatments. Ambiguous operator-only branding remained generic.

All existing v1 asset URLs are immutable. The two added treatments expanded the
library without replacing prior bytes, so browser cache identity remains valid.

## Feed design and reliability

- Live positions come from adsb.lol; route, airline, and aircraft enrichment
  comes from ADSBDB.
- Worker-side caching, timeouts, bounded lookup concurrency, stale-data
  handling, and browser backoff keep the page responsive when upstream services
  are slow or unavailable.
- Routes are checked for plausibility before display, and unknown or incomplete
  data degrades cleanly.
- The Worker records privacy-conscious operational observations for aggregate
  coverage analysis; development tooling supports idempotent log downloads.
- The site and its approved artwork are fully static at runtime. Image
  generation services, credentials, and development tooling are not required in
  production.

## Quality and performance

The completed artwork program passed manifest/image parity, alpha, dimensions,
padding, clipping, resolver, fallback, hostile-input, switching, caching, and
browser interaction checks. The final development baseline reported 133 unit
tests and 4 Playwright browser tests passing.

Throttled mobile checks confirmed that only visible unique aircraft images are
requested, duplicate treatments share a request, and warm-cache image transfers
remain at zero bytes. The release library contains 152 production WebPs totaling
approximately 6.2 MiB, but it is loaded on demand rather than preloaded.

## Deployment and operation

The frontend is served directly by GitHub Pages with no production build step.
The API is deployed separately as a Cloudflare Worker from `api/`. For local
development, use Node.js 20 or newer and run `npm install` followed by
`npm run dev` (or `npm run demo` for deterministic sample traffic).

## Licensing

Software source code is available under the PolyForm Noncommercial License
1.0.0. Farm photography, aircraft artwork, branding, and authored site content
are excluded from that license and remain all rights reserved; see
`ASSETS-LICENSE.md` and `NOTICE`.

## Full history

This release contains the complete project history from the initial site on
October 20, 2026 through the v1.0.0 release on November 9, 2026. See the Git
commit history and closed GitHub issues PG-001 through PG-027 for the detailed
implementation decisions, generation reviews, validation results, and release
gates behind this milestone.
