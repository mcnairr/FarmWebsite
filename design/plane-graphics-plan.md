# Plan: airline-colored vector plane graphics

Status: not started. Written 2026-10-28.

## Goal

Replace the two generic plane drawings in the flight feed with a small
library of side-view aircraft shapes painted in each airline's colors, so a
Southwest 737 looks different from a FedEx 767 or a Cessna 172. Closer to
the mockup (`design/mockups/`) without copying any real artwork.

## Ground rules

- **No logos, wordmarks, or text** in any drawing (no "American" title, no
  Delta widget, no United globe, no Alaska face, no Frontier animals, no
  FedEx/UPS marks). Liveries are suggested by color and simple shapes only.
  This keeps the site clear of trademark use and lets the existing
  left/right mirroring work without reversed text.
- **Original drawings.** Draw shapes from published dimensions (length, fin
  height, engine placement), not by tracing photos or third-party drawings.
- **Same visual style as today:** flat vector, soft top-lit shading, no
  outlines, pure side view facing right, CSS drop shadow (already in
  `flight-feed.css`).
- **Colors come only from the static livery table.** Never put a string from
  the API (callsign, airline name, type) into SVG markup.

## Current state (what this replaces)

- `index.html` (bottom): hidden SVG sprite with `#ff-jet`, `#ff-prop`,
  `#ff-glyph-plane` and four shared gradients (`#ff-body`, `#ff-tail`,
  `#ff-wing`, `#ff-engine`). Every airliner gets the same blue-tailed jet.
- `flight-feed.js` `fillFlight()`: picks `#ff-prop` when
  `aircraftClass === 'light'`, else `#ff-jet`, by swapping the `<use href>` in
  `.ff-plane`; toggles `.is-light`.
- `flight-feed.js` `renderTraffic()`: same choice for the small background
  planes (`.ff-blip`).
- `flight-feed.css`: `.ff-plane.is-light` and `.ff-blip.is-light` shrink the
  light plane; `.ff-blip[data-facing="left"]` / `--ff-flip` mirror.

Data available per aircraft in the browser (`NormalizedAircraft`,
`api/src/types.js`): `callsign`, `airline` (display name), `icaoType`
(e.g. `B738`), `aircraftClass` (`airliner` | `light` | `other`). No API change
is needed: the airline is taken from the callsign prefix (same rule as
`airlineFromCallsign()` in `api/src/reference.js`) and the shape from
`icaoType`.

## Design

### Rendering approach

Generate each plane's SVG markup in the browser from data, instead of using
fixed `<symbol>`s. Reason: gradients and clip paths referenced from a `<use>`
can't change color per instance, and liveries need per-plane colors and
patterns. Generating markup per plane lets each instance have its own ids.

New file `flight-feed-art.js` (pure functions, no DOM, imported by
`flight-feed.js`, unit-tested like `flight-feed-model.js`):

```js
/** Which drawing to use. Falls back to aircraftClass when the type is unknown. */
export function planeShape(icaoType, aircraftClass) // -> ShapeId

/** Paint scheme from the callsign's 3-letter airline prefix, else a default for the shape. */
export function planeLivery(callsign, shapeId)      // -> Livery

/** Inner markup for <svg viewBox="0 0 320 110">. uid makes clip/gradient ids unique. */
export function planeMarkup(shapeId, livery, { uid, detail = 'full' }) // -> string

/** Relative display size so a 777 reads bigger than an E175. */
export function planeSize(shapeId)                  // -> 's' | 'm' | 'l' | 'xl'
```

Data lives in two plain-object modules so drawings and colors are edited
separately: `flight-feed-shapes.js` and `flight-feed-liveries.js`.

### Shape definition

Every shape uses the existing `viewBox="0 0 320 110"`, faces right, and
supplies named path layers, drawn in this order:

| Layer | Purpose |
|---|---|
| `farWing`, `farStabilizer` | far-side surfaces, drawn darker, behind the body |
| `fin` | vertical tail; also used as a clip path for fin patterns |
| `body` | fuselage outline; also used as a clip path for body paint |
| `windows`, `cockpit`, `doors?` | dark details (skipped at `detail: 'low'`) |
| `wing`, `stabilizer` | near-side surfaces |
| `engines` | nacelles + pylons (array; trijet adds one in the tail) |
| `extras` | shape-specific bits: 747 hump, prop disc, rotor, fixed gear |

Each shape also states its fin and body bounding boxes so livery patterns
(defined in 0–1 units) can be scaled onto them with a `transform` and
clipped to the `fin` or `body` path.

Shading is layered on top of the paint, not baked into the colors: one
white→transparent highlight on the upper body and one transparent→dark
gradient on the belly, both clipped to `body`. That gives every livery the
same lighting, so a yellow plane and a navy plane look like they belong
together.

### Shapes (≈11, in build order)

| Id | Look | ICAO types |
|---|---|---|
| `narrowbody` | twin under-wing engines, conventional tail | `A19N A20N A21N A318 A319 A320 A321 B733–B739 B37M B38M B39M B3XM B752 B753 BCS1 BCS3` |
| `regional` | shorter, smaller under-wing engines, fewer windows | `E170 E75L E75S E190 E195 E290` |
| `rearjet` | engines on the rear fuselage, T-tail | `CRJ2 CRJ7 CRJ9 CRJX E135 E145 B712 MD88 MD90` |
| `widebody` | twin, deeper fuselage, big engines | `B762 B763 B764 B772 B77L B773 B77W B778 B779 B788 B789 B78X A332 A333 A339 A359 A35K` |
| `trijet` | widebody with third engine in the tail (FedEx/UPS MD-11s are common overhead) | `MD11` |
| `jumbo` | four engines, 747 upper-deck hump | `B744 B748 A388` |
| `turboprop` | high wing, two props, airliner body | `DH8D AT76` |
| `bizjet` | small, rear engines, T-tail | `C25A C25B C56X C68A C700 C750 CL30 CL35 CL60 GLF4 GLF5 GLF6 GLEX E50P E55P LJ45 LJ75 H25B BE40 PC24 SF50` |
| `light-high` | high-wing single (redraw of today's prop) | `C150 C152 C172 C182 C206 C208 C210` |
| `light-low` | low-wing single/twin, incl. single turboprops | `PA28 P28A PA32 PA46 P46T SR20 SR22 BE35 BE36 BE58 M20P TBM7 TBM9 PC12 BE20 B350 BE9L AEST PAY3` |
| `agplane` | Air Tractor crop duster: big nose, single seat, fixed gear. A fitting extra for a farm site. | `AT5T AT6T AT8T` |
| `helicopter` | side-view light helicopter, rotor as a thin translucent bar | `EC35 EC45 B407 B06 A109` |

Military types (`C130 C17 K35R`) use the nearest shape (`turboprop` for
C-130, `widebody` for C-17/KC-135) with the gray military livery.

Fallbacks when `icaoType` is missing or not listed:
`airliner` → `narrowbody`, `light` → `light-high`, `other` → `bizjet`.

Sizes (`planeSize`): `regional`, `rearjet`, `turboprop` = `m`;
`narrowbody` = `l`; `widebody`, `trijet`, `jumbo` = `xl`;
`bizjet`, `light-*`, `agplane`, `helicopter` = `s`. CSS sets widths per size,
replacing the current `.is-light` rules.

### Livery definition

```js
/** @typedef {{
 *   body: string,                    // base fuselage color
 *   crown?: { color: string, to: number },   // upper body painted down to `to` (0–1 of body height)
 *   belly?: { color: string, from: number }, // lower body painted from `from`
 *   cheatline?: { colors: string[], y: number, width: number },
 *   sweep?: { colors: string[] },    // diagonal bands rising from belly toward the fin (Southwest/Alaska style)
 *   fin: { color: string, pattern?: 'split' | 'stripes' | 'band' | 'arc', accents?: string[] },
 *   engine: string,
 *   wing?: string,                   // default light gray
 * }} Livery */
```

Fin patterns are a short, fixed set, drawn in 0–1 units and clipped to the
fin: `split` (diagonal two-tone), `stripes` (diagonal parallel stripes),
`band` (horizontal band near the base), `arc` (curved lighter sweep).

### Starting livery table

Hex values are starting points; tune them against reference photos during
implementation. Descriptions are color and placement only, with no marks.

| Prefix | Airline | Scheme |
|---|---|---|
| `AAL` | American | silver-gray body `#d9dde2`; fin navy `#0b2c5c` with red `#c8102e` / white `stripes`; engines light gray |
| `UAL` | United | white body; blue belly and engines `#0a2f6b`; fin `#0a2f6b` with lighter `arc` `#2f6db5` |
| `DAL` | Delta | white body; navy belly and engines `#0b2f63`; fin `split` red `#c8102e` over navy |
| `SWA` | Southwest | blue crown and fin `#304cb2`; `sweep` red `#e31837` + yellow `#ffbf27` along the lower rear body; silver belly |
| `ASA` | Alaska | white body; fin navy `#01426a`; teal `sweep` `#48a9c5` near the tail |
| `JBU` | JetBlue | white body; navy belly, fin, engines `#003876` |
| `FFT` | Frontier | white body; fin and engines green `#006341` |
| `NKS` | Spirit | yellow body and fin `#ffe600`; dark engines `#1f1f1f` |
| `AAY` | Allegiant | white body; navy fin `#0d2d5e` with orange `band` `#f68b1f` |
| `SCX` | Sun Country | white body; navy fin and engines `#0d2d5e` with orange `band` `#f47b20` |
| `HAL` | Hawaiian | white body; fin `split` purple `#5a2a82` / magenta `#d6006e` |
| `FDX` | FedEx | purple crown and fin `#4d148c`; white lower body; gray belly; light engines |
| `UPS` | UPS | brown fin `#351c15` with gold `band` `#ffb500`; body colors to be checked against photos |
| `GTI` `ABX` `ATN` | cargo (Atlas, ABX, ATI) | white body; navy fin `#1c2f5b`; light engines |
| `ACA` | Air Canada | white body; black belly, fin, engines; small red accent `#d22630` |
| `WJA` | WestJet | white body; fin `split` teal `#00aaa5` / navy `#13294b`; navy engines |
| `EJA` `LXJ` | NetJets, Flexjet | bizjet default |

Defaults when the airline is unknown or not listed:

| Default | Scheme |
|---|---|
| airliner (any airliner shape) | white body, today's slate-blue fin `#2f5a92`, light engines |
| regional partner (see below) | white body, slate-gray fin `#6b7a8f`, light engines |
| `bizjet` | white body, thin navy cheatline `#2b3a55` |
| `light-high`, `light-low` | white body, red `#b3262d` + navy cheatline |
| `agplane` | yellow body and fin `#f2c200`, dark engine cowl |
| `helicopter` | white body, navy band |
| military types | flat gray `#8a939c` throughout |

### Regional airlines

Regional carriers fly in their mainline partner's paint, and the callsign
shows only the regional operator. Map a regional to a partner livery only if
it flies for one partner; otherwise use the neutral regional default.
**Check current contracts before implementing; these change.**

| Prefix | Operator | As of writing | Livery |
|---|---|---|---|
| `ENY` | Envoy | American Eagle only | `AAL` |
| `JIA` | PSA | American Eagle only | `AAL` |
| `EDV` | Endeavor | Delta Connection only | `DAL` |
| `QXE` | Horizon | Alaska only | `ASA` |
| `GJS` | GoJet | United Express only | `UAL` |
| `AWI` | Air Wisconsin | verify | verify |
| `ASH` | Mesa | verify | verify |
| `SKW` | SkyWest | United, Delta, American, Alaska | neutral |
| `RPA` | Republic | several partners | neutral |

## Integration steps

1. **`flight-feed-art.js` + data modules** with the functions above.
2. **`flight-feed.js` `fillFlight()`**: replace the `<use>` swap with
   `el.plane.innerHTML = planeMarkup(...)` and set `el.plane.dataset.size`.
   Only rebuild the markup when the shape or livery changes (cache the last
   key), so 15-second refreshes don't redraw the same plane. Keep the
   `--ff-tilt` / `--ff-flip` pose code unchanged.
3. **`renderTraffic()` blips**: same, with `detail: 'low'` (no windows or
   cheatline; at 2.9rem wide only body, fin color and engines read). Replace
   the inner `<svg><use></use></svg>` with the generated markup when the key
   changes.
4. **`flight-feed.css`**: replace `.ff-plane.is-light` / `.ff-blip.is-light`
   with `[data-size="s|m|l|xl"]` widths for both, including the desktop
   media-query overrides (`.ff-plane` and `.ff-blip` near the end of the file).
   Keep current `l` widths equal to today's jet so the layout doesn't shift.
5. **`index.html`**: delete `#ff-jet`, `#ff-prop` and the four gradients from
   the sprite. Keep `#ff-glyph-plane` (the small icon in the card).
6. **Demo data** (`api/src/providers/demo.js`): add a few flights so demo mode
   shows the variety: a FedEx `MD11`, a SkyWest `CRJ9`, an Air Tractor
   `AT8T`, a bizjet. Add a `gallery` scenario only if it helps review.
7. **Gallery page** `design/plane-gallery.html` (dev only, not linked from the
   site): imports `flight-feed-art.js` and renders every shape in its default
   livery, every livery on its usual shape, each facing both ways, at card
   size and blip size, on the sky photo. View with `npm run dev`, which serves
   the repo root.
8. **README**: replace the "same plane for everyone" description with a short
   note on shapes, liveries, and how to add an airline.

## Tests (`test/flight-feed-art.test.js`)

- Every ICAO code in the shape table maps to an existing shape; unknown codes
  fall back by `aircraftClass`.
- Every livery value is a `#rrggbb` hex (guards against markup injection).
- `planeMarkup` for every shape × livery: contains no `NaN`/`undefined`, no
  `<text>` or `<image>`, and every `id` includes the `uid` (two planes on one
  page can't collide).
- Callsign prefix lookup: `SWA1896` → Southwest, `N7351D` → default,
  `null` → default, `ENY3456` → American colors, `SKW5412` → neutral.
- `planeSize` is defined for every shape.

## Budget and checks

- All shapes + liveries together under ~25 KB unminified (today's sprite is
  ~3 KB). Loaded only by `flight-feed.js`, so it costs nothing when the feed
  is off.
- Each shape must be recognizable at card size (~9–15rem wide) and as a blip
  (~2.9rem), facing either way, climbing or descending (±5° tilt).
- Visual check with headless Edge screenshots of the gallery page and demo
  scenarios. Note: headless Edge won't render narrower than ~500px, so check
  true phone width in a real browser or device emulation.
- `npm test` passes; no layout shift in the card or route row compared with
  today.

## Suggested phases

1. **Foundation:** art module, shading, `narrowbody`, `regional`, `rearjet`,
   default liveries, integration, gallery, tests. Ship once it looks at
   least as good as today.
2. **Liveries:** the airline table above.
3. **Remaining shapes:** `widebody`, `trijet`, `bizjet`, `light-high`,
   `light-low`, then `jumbo`, `turboprop`, `agplane`, `helicopter`.

## Open questions

- Which airlines to include in phase 2. The table above covers the common
  traffic over Chase County; trim or add as wanted.
- Keep the Air Tractor crop-duster shape? Low traffic at cruise altitudes,
  but local ag flights would show it.
- Optional later API change: pass the ADS-B emitter category to the browser
  so unknown types can still pick `widebody` (category A5) or `helicopter`
  (A7) instead of the class fallback.
