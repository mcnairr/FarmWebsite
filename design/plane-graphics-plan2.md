# Plan 2: branded Vertex AI plane artwork library

Status: revised design plan. Written 2026-10-29. No site implementation started.

## Decision

Replace the proposed browser-side SVG drawing system with a large, curated
library of branded, photorealistic aircraft images generated with Google Vertex
AI. Generate and approve the artwork during development, commit the finished
web assets, and serve them as ordinary static files from GitHub Pages.

Vertex AI is the only generation provider planned for this library. It keeps the
art-production work separate from the owner's monthly OpenAI subscription limits.
Vertex is used only while creating assets; it is never called by a visitor's
browser, and no Google credential is shipped to the public site.

The approved proofs establish that branded artwork is preferred. Airline names,
tail logos, recognizable paint schemes, and small incidental generated lettering
are acceptable. The primary airline name should still be recognizable and
reasonably spelled, but tiny imperfect lettering is not grounds by itself to
reject an otherwise beautiful image.

Every approved aircraft treatment receives **two independently generated master
images**:

- one facing right, with all branding readable; and
- one facing left, with all branding readable.

Images are never mirrored in CSS. This avoids backwards airline names, logos,
registrations, and incidental lettering.

## Library size

The target library is **74 aircraft/livery treatments × 2 directions = 148
custom images**.

This is intentionally much larger than a minimal 12-25 image set. It should make
the flight tracker feel rich even when unusual aircraft appear, while remaining
comfortably below 200 approved custom images.

Counting rules:

- “custom image” means one approved directional artwork master.
- Rejected generation candidates do not count toward the library.
- Mechanical format conversions or resized derivatives are not additional custom
  artwork, although the initial implementation should avoid unnecessary
  derivatives so the repository also stays easy to understand.
- The initial target is 148 approved masters.
- The library may grow to **160 approved masters** without redesigning the plan.
- Going above 160, and especially approaching 200, requires a deliberate review
  of value, repository size, and download behavior.

## Target look

- Premium, lightly photorealistic aircraft cutouts like the plane in
  `design/mockups/McNair Farms Live Flight Tracker mockup.png`.
- Consistent three-quarter side view with enough wing visible to feel dimensional,
  but not so much perspective that the aircraft looks head-on.
- Soft daylight from above-left, realistic materials, restrained highlights, and
  no baked-in ground shadow.
- Landing gear retracted unless the aircraft type is visually defined by fixed
  gear, such as some crop dusters.
- No clouds, scenery, contrails, people, borders, watermarks, or cropped aircraft
  extremities.
- A clean transparent background after post-processing. Vertex may produce a
  white background; background removal is therefore a normal pipeline step.
- A common transparent canvas, visual baseline, scale system, and padding so
  switching flights does not make the route jump.
- Accurate overall aircraft category and engine count. Minor generated surface
  details and tiny incidental lettering may be imperfect.

The mockup establishes the desired finish, but it should not be used as a model
input unless the underlying plane image is ours or appropriately licensed.

## Planned artwork matrix

The matrix contains 74 treatments. Each row produces a separate right-facing and
left-facing image, for 148 final custom images.

### Scheduled passenger and cargo aircraft: 47 treatments / 94 images

| # | Artwork id | Treatment | Shape |
|---:|---|---|---|
| 1 | `aal-narrowbody` | American Airlines | 737/A320-class narrowbody |
| 2 | `aal-widebody` | American Airlines | 787/777-class widebody |
| 3 | `ual-narrowbody` | United Airlines | 737/A320-class narrowbody |
| 4 | `ual-widebody` | United Airlines | 787/777-class widebody |
| 5 | `dal-narrowbody` | Delta Air Lines | 737/A320-class narrowbody |
| 6 | `dal-widebody` | Delta Air Lines | A330/A350-class widebody |
| 7 | `swa-narrowbody` | Southwest Airlines | 737-class narrowbody |
| 8 | `asa-narrowbody` | Alaska Airlines | 737-class narrowbody |
| 9 | `jbu-narrowbody` | JetBlue | A320-class narrowbody |
| 10 | `fft-narrowbody` | Frontier Airlines | A320-class narrowbody |
| 11 | `nks-narrowbody` | Spirit Airlines | A320-class narrowbody |
| 12 | `aay-narrowbody` | Allegiant Air | A320-class narrowbody |
| 13 | `scx-narrowbody` | Sun Country Airlines | 737-class narrowbody |
| 14 | `hal-narrowbody` | Hawaiian Airlines | A321-class narrowbody |
| 15 | `hal-widebody` | Hawaiian Airlines | A330/787-class widebody |
| 16 | `aca-narrowbody` | Air Canada | A220/737-class narrowbody |
| 17 | `aca-widebody` | Air Canada | 787-class widebody |
| 18 | `wja-narrowbody` | WestJet | 737-class narrowbody |
| 19 | `amx-narrowbody` | Aeroméxico | 737-class narrowbody |
| 20 | `voi-narrowbody` | Volaris | A320-class narrowbody |
| 21 | `baw-widebody` | British Airways | 787/777-class widebody |
| 22 | `dlh-widebody` | Lufthansa | A350/747-class widebody |
| 23 | `afr-widebody` | Air France | 777/A350-class widebody |
| 24 | `klm-widebody` | KLM | 787/777-class widebody |
| 25 | `fdx-trijet` | FedEx | MD-11 trijet |
| 26 | `fdx-widebody` | FedEx | 767/777-class cargo widebody |
| 27 | `ups-trijet` | UPS Airlines | MD-11 trijet |
| 28 | `ups-widebody` | UPS Airlines | 767-class cargo widebody |
| 29 | `gti-widebody` | Atlas Air | 747/767-class cargo widebody |
| 30 | `dhl-widebody` | DHL-branded cargo | 767-class cargo widebody |
| 31 | `american-eagle-regional` | American Eagle | E175/CRJ-class regional jet |
| 32 | `delta-connection-regional` | Delta Connection | E175/CRJ-class regional jet |
| 33 | `united-express-regional` | United Express | E175/CRJ-class regional jet |
| 34 | `alaska-regional` | Alaska/Horizon | E175-class regional jet |
| 35 | `generic-regional` | attractive neutral regional fallback | regional jet |
| 36 | `generic-narrowbody` | attractive neutral airline fallback | narrowbody |
| 37 | `generic-widebody` | attractive neutral airline fallback | widebody |
| 38 | `dal-b717` | Delta Air Lines | Boeing 717 rear-engine jet |
| 39 | `dal-b757` | Delta Air Lines | Boeing 757 long narrowbody |
| 40 | `ual-b787` | United Airlines | Boeing 787 Dreamliner |
| 41 | `aal-b777` | American Airlines | Boeing 777 widebody |
| 42 | `dlh-b747` | Lufthansa | Boeing 747-8 jumbo |
| 43 | `baw-a380` | British Airways | Airbus A380 super-jumbo |
| 44 | `jbu-a220` | JetBlue | Airbus A220 |
| 45 | `jbu-e190` | JetBlue | Embraer E190 |
| 46 | `united-express-crj200` | United Express | Bombardier CRJ-200 |
| 47 | `delta-connection-crj900` | Delta Connection | Bombardier CRJ-900 |

Regional operators may fly for more than one mainline airline. When the callsign
does not determine the actual partner confidently, use `generic-regional` rather
than displaying a confidently wrong brand.

### Business, general aviation, and turboprops: 15 treatments / 30 images

| # | Artwork id | Treatment | Shape |
|---:|---|---|---|
| 48 | `netjets-bizjet` | NetJets-branded | midsize business jet |
| 49 | `flexjet-bizjet` | Flexjet-branded | midsize business jet |
| 50 | `generic-bizjet-small` | polished neutral paint | Citation/Phenom-class jet |
| 51 | `generic-bizjet-large` | polished neutral paint | Gulfstream/Global-class jet |
| 52 | `cessna-high-wing` | classic private-aircraft paint | C150/C172/C182/C206 |
| 53 | `cessna-caravan` | utility paint | C208 Caravan |
| 54 | `piper-low-wing` | classic private-aircraft paint | PA-28/PA-32/PA-46 |
| 55 | `cirrus-low-wing` | modern premium paint | SR20/SR22 |
| 56 | `beech-piston` | classic private-aircraft paint | Bonanza/Baron |
| 57 | `king-air` | polished corporate paint | King Air twin turboprop |
| 58 | `pilatus-pc12` | polished corporate paint | PC-12 |
| 59 | `daher-tbm` | modern premium paint | TBM single turboprop |
| 60 | `dash8` | neutral regional-airline paint | Dash 8/Q400 |
| 61 | `atr` | neutral regional-airline paint | ATR 72 |
| 62 | `generic-twin-piston` | classic private-aircraft paint | light piston twin |

Registration numbers may be fictional or omitted. They must never reproduce a
real private owner's registration intentionally.

### Crop dusters, helicopters, and military aircraft: 12 treatments / 24 images

| # | Artwork id | Treatment | Shape |
|---:|---|---|---|
| 63 | `air-tractor-yellow` | bright yellow agricultural scheme | Air Tractor |
| 64 | `air-tractor-red-white` | red and white agricultural scheme | Air Tractor |
| 65 | `thrush-yellow-blue` | yellow and blue agricultural scheme | Thrush crop duster |
| 66 | `crop-duster-green` | green and yellow farm-themed scheme | generic crop duster |
| 67 | `bell-206` | neutral civilian scheme | Bell 206 helicopter |
| 68 | `bell-407` | premium civilian scheme | Bell 407 helicopter |
| 69 | `h135-medical` | recognizable medical-service treatment | Airbus H135 helicopter |
| 70 | `police-helicopter` | generic police treatment, no agency claim | light helicopter |
| 71 | `utility-helicopter` | news/utility treatment | light helicopter |
| 72 | `c130-military` | neutral U.S. military gray | C-130 Hercules |
| 73 | `c17-military` | neutral U.S. military gray | C-17 Globemaster |
| 74 | `kc135-military` | neutral U.S. military gray | KC-135 tanker |

Generic police, medical, utility, and military art should be recognizable by
category without copying a local agency's exact insignia or inventing an
official-looking affiliation.

## ICAO type and callsign resolution

The browser maps the live aircraft to one of the 74 artwork ids using static,
reviewed tables.

Resolution order:

1. exact airline/cargo brand plus compatible aircraft family;
2. branded regional treatment when the operating partnership is known;
3. exact special-aircraft treatment such as Air Tractor, helicopter, or military;
4. branded airline treatment on the closest compatible family;
5. generic family treatment; and
6. the current SVG jet/prop only as an image-load error fallback during rollout.

Direction is selected from the existing heading logic. Eastbound/right-facing
traffic receives the `right` file; westbound/left-facing traffic receives the
independently generated `left` file. No transform or mirror is applied.

Do not construct paths from callsigns, airline names, or other API strings. All
untrusted values are normalized and looked up in the static manifest.

## Files and metadata

Proposed layout:

```text
assets/planes/v1/
  aal-narrowbody-right.webp
  aal-narrowbody-left.webp
  swa-narrowbody-right.webp
  swa-narrowbody-left.webp
  air-tractor-yellow-right.webp
  air-tractor-yellow-left.webp
  ...approximately 148 approved directional assets...
  manifest.js
design/plane-art/
  prompts.json
  shape-guides/
  proofs/
  README.md
scripts/
  generate-vertex-plane-proofs.ps1
  generate-plane-library.ps1
  process-plane-art.mjs
```

The existing Vertex proofs and their metadata remain design references. Raw bulk
generation candidates belong in a gitignored directory such as
`.generated/plane-art/`. Only approved, processed production images are committed.

Each manifest record states:

- artwork id and direction;
- file URL and intrinsic dimensions;
- applicable ICAO types and callsign prefixes;
- visual size class;
- generation model, prompt record, and approval status; and
- fallback artwork id.

Use a versioned asset directory. A future replacement library can go in `v2` so
visitors never see stale cached art.

## Download behavior and performance

GitHub Pages does not cause the browser to download every plane in the repository.
An image is fetched only when its URL is assigned to an `<img>`, explicitly
prefetched, or otherwise referenced by the rendered page.

Use separate files, not an atlas or sprite sheet:

- the selected flight loads one directional image;
- each visible background aircraft loads only its required directional image;
- identical planes and directions reuse the browser cache;
- selecting another flight fetches its image on demand; and
- the other 140-plus assets remain untouched until actually needed.

Start with one production WebP per approved directional master, approximately
960 × 330 after transparent cropping and normalization. The same file can serve
the hero plane and blips, which also means a blip promoted to the selected flight
is already cached. Target roughly 40-110 KB per asset and measure actual cold-cache
behavior before choosing final quality settings.

If background traffic proves too expensive, mechanically derive small blip WebPs
later. Those are format derivatives, not new custom artwork, but they should be
added only after measurement because they double the asset-file inventory.

For the selected image use explicit intrinsic dimensions, `decoding="async"`, and
high fetch priority. Do not lazy-load the above-the-fold selected plane. Optional
idle prefetching may fetch only the previous and next flight after the current
image has loaded; never preload the full library.

Performance gates:

- no layout shift while an image loads or falls back;
- a typical first view transfers no more than the selected plane and visible
  unique blips;
- no request for an unused airline or aircraft;
- cached images are reused when switching selections; and
- the page remains pleasant on a throttled mobile connection.

## Vertex AI generation workflow

The current proof workflow uses Google Cloud Vertex AI with
`gemini-3.1-flash-image`. Before bulk generation, verify Google's current
recommended Vertex image model and pin the selected model id in generation
metadata. Model names will change over the life of the site; the committed assets
must not depend on a model remaining available.

For each of the 74 treatments:

1. Select or create an original shape guide for the aircraft family.
2. Generate the right-facing master using the treatment prompt, shape guide, and
   the approved visual-style reference.
3. Generate the left-facing master as a separate image, using the approved
   right-facing result as a livery/style reference while explicitly requiring
   correctly oriented readable branding.
4. Request several candidates when necessary. Human selection is mandatory;
   model output is never published automatically.
5. Check the main wordmark, tail branding, aircraft category, engine count,
   direction, anatomy, crop, and overall attractiveness. Tiny incidental lettering
   defects are acceptable.
6. Remove the white background or repair alpha edges. Do not rely on the model to
   return usable transparency.
7. Normalize crop, scale, baseline, transparent padding, color space, and canvas.
8. Encode the production WebP without destroying fine details or transparent
   edges.
9. Record provider, project, model id, prompt, reference files, generation date,
   direction, and approval notes in `prompts.json`.
10. Review both directions in the real route layout at hero and blip sizes.

The second direction should match its partner closely, but it does not need to be
pixel-identical. Natural variation is acceptable as long as the pair clearly
represents the same aircraft family and livery.

## Credential and billing safety

- Generation runs locally or in a deliberately configured private environment,
  never in GitHub Pages or frontend JavaScript.
- Use the local service-account credential through a supplied credential path or
  Application Default Credentials. Never hard-code its filename or contents into
  public code.
- `.secrets/` remains gitignored.
- Never log access tokens, private keys, or full credential contents.
- Record generation counts so accidental reruns do not create avoidable Vertex
  charges.
- The batch workflow must support selecting particular artwork ids and directions;
  it must not regenerate all 148 images merely to replace one bad asset.
- The public site depends only on committed WebPs and continues working if Vertex
  is unavailable, billing is disabled, or the Google project is removed.

## Browser integration design

A small pure art resolver will provide static asset records without embedding
image data:

```js
planeFamily(icaoType, aircraftClass)
planeArtwork(aircraft)
planeAsset(artworkId, direction)
```

`flight-feed.js` will change from swapping an SVG `<use>` to setting `<img>`
properties. Preserve the existing heading, tilt, selection, animation, and keyed
blip behavior, but remove all CSS horizontal mirroring from plane artwork.

Retain the current SVGs during rollout as image `error` fallbacks. A broken or
missing WebP must never leave an empty route.

## Gallery and review gates

Add a dev-only `design/plane-gallery.html` showing:

- all 74 treatments as adjacent right/left pairs;
- hero and blip display sizes;
- climb, level, and descent tilts;
- the production sky background and a checkerboard alpha view;
- filename, byte size, artwork mapping, model, and approval state; and
- filters for airline, cargo, general aviation, crop duster, helicopter, and
  military categories.

Reject an image for:

- wrong facing direction or a backwards primary wordmark;
- a badly misspelled or unrecognizable main airline name;
- grossly malformed wings, tail, engines, rotors, propellers, or landing gear;
- an engine/rotor count that contradicts the assigned family;
- inconsistent camera angle, extreme scale mismatch, bad crop, or broken baseline;
- clipped extremities, opaque corners, matte halos, or severe color fringing;
- a watermark or unrelated scenery; or
- poor recognition at hero size or an ugly silhouette at blip size.

Do **not** reject an otherwise strong image solely for tiny plausible incidental
lettering, minor panel-detail inventions, or small differences between its left
and right versions.

The gallery may be screenshot-tested, but final approval is visual and manual.

## Automated checks planned for implementation

- Every ICAO mapping resolves to a known artwork id or explicit fallback.
- Every approved treatment has both `left` and `right` files.
- Every manifest entry points to an existing image with declared dimensions.
- Unknown or hostile API strings resolve only to static generic assets.
- No public module contains Vertex credentials, tokens, or SDK code.
- Asset dimensions, type, alpha, and byte ceilings are validated.
- Every image has a metadata record, and every approved record has an image.
- No duplicate mapping accidentally makes a helicopter use a jet or vice versa.
- Existing pose and route tests continue to pass after mirroring is removed.
- Browser checks cover successful loads, missing-file fallback, caching, flight
  switching, and both directions.

## Phased artwork production

### Phase 0: completed proof direction

The OpenAI and Vertex proofs established that branded, photorealistic aircraft
are the preferred direction. The production library will use Vertex AI. White
background removal and production optimization remain to be proven.

### Phase 1: 16 treatments / 32 images

Produce both directions for the highest-value set:

- American, United, Delta, and Southwest narrowbodies;
- American, United, Delta, FedEx, and UPS widebody/cargo treatments;
- American Eagle, generic regional, generic narrowbody, and generic widebody;
- one business jet, one Cessna high-wing, and one Air Tractor.

Build the review gallery and validate background removal, pair consistency,
actual file sizes, and on-sky appearance before scaling the batch.

### Phase 2: reach 40 treatments / 80 images

Add the remaining common North American airlines, regional partners, business and
general-aviation aircraft, turboprops, and the second Air Tractor treatment.

### Phase 3: reach 74 treatments / 148 images

Complete international airlines, remaining cargo carriers, crop dusters,
helicopters, and military aircraft. Review the full mapping for obvious local
traffic gaps.

### Phase 4: optional growth, hard review at 160 images

Use observed real traffic to add at most 6 more treatments / 12 directional
images without revisiting the architecture. Favor genuinely new silhouettes or
frequent missing brands. Do not grow toward 200 merely to cover theoretical
combinations.

## Why this replaces Plan 1

Plan 1's vector system is compact and infinitely recolorable, but its complexity
is front-loaded into path drawing, clipping, livery rules, gradients, unique SVG
ids, and a large shape-maintenance surface. Even a good implementation would
produce a clean icon-like result rather than the rich aircraft seen in the
mockup and approved proofs.

Plan 2 accepts a larger curated asset library and a substantial visual-review
effort in exchange for much better hero artwork and simpler browser rendering.
Independent left/right images solve the backwards-branding problem, and on-demand
static loading prevents the 148-image library from becoming a 148-image initial
download.

## Decisions remaining before implementation

1. Approve or revise the exact 74-treatment matrix.
2. Decide whether the Phase 1 art should be strictly photorealistic or slightly
   polished/stylized for better consistency across many generations.
3. Approve the production background-removal method after comparing edge quality
   over the real blue-sky photograph.
4. Confirm the final normalized canvas dimensions and WebP quality from measured
   browser results.
5. Decide whether high-quality raw PNG masters should be archived outside Git or
   whether the committed WebPs plus prompts and metadata are sufficient.

## Reference documentation

- Google Cloud: [Generate images with Gemini](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation)
- Google Cloud: [Vertex AI generative AI release notes](https://cloud.google.com/vertex-ai/generative-ai/docs/release-notes)
- Google Cloud: [Gemini image editing](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-editing)
