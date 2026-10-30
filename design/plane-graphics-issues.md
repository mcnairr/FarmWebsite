# GitHub issue backlog: branded Vertex AI plane artwork library

Source plan: [`design/plane-graphics-plan2.md`](./plane-graphics-plan2.md)  
Prepared: 2026-10-29  
Purpose: issue definitions only. This file does **not** create or log GitHub issues.

## How to log this backlog

- Create the milestones and labels below first, then log issues in the listed order.
- Keep the `PG-###` key at the start of each GitHub issue title. It is a stable dependency reference, not a GitHub issue number.
- Replace each `Depends on` key with a GitHub issue link after logging.
- Do not start a dependent issue merely because its predecessor's code exists; the predecessor's acceptance criteria must be met.
- Artwork approval is manual. Automation may reject invalid files, but it must never publish generated art automatically.
- Production image generation uses Vertex AI only. Vertex is a development tool and must never become a browser/runtime dependency.

## Proposed milestones

| Milestone | Exit condition |
|---|---|
| `Plane art — Phase 0: foundation` | Art direction and matrix approved; safe, selective generation and deterministic processing/validation are ready. |
| `Plane art — Phase 1: 32 images` | The first 16 treatments have approved left/right WebPs and pass the gallery, validation, browser integration, and performance gates. |
| `Plane art — Phase 2: 80 images` | The library reaches 40 approved treatments / 80 images without regressions. |
| `Plane art — Phase 3: 148 images` | All 74 planned treatments / 148 images are approved, mapped, validated, and released. |
| `Plane art — Phase 4: observed growth` | Real traffic has been reviewed; zero to six justified additions are shipped, never exceeding 160 approved masters. |

## Proposed labels

`plane-art`, `decision`, `tooling`, `metadata`, `generation`, `manual-review`, `frontend`, `testing`, `performance`, `security`, `documentation`, `phase-0`, `phase-1`, `phase-2`, `phase-3`, `phase-4`

## Locked treatment allocation for issue planning

This allocation turns the plan's phase descriptions into exact, countable batches. PG-001 may revise it before production begins, but any revision must preserve the 16 / 40 / 74 cumulative treatment gates.

### Phase 1 — 16 treatments / 32 images

`aal-narrowbody`, `aal-widebody`, `ual-narrowbody`, `ual-widebody`, `dal-narrowbody`, `dal-widebody`, `swa-narrowbody`, `fdx-widebody`, `ups-widebody`, `american-eagle-regional`, `generic-regional`, `generic-narrowbody`, `generic-widebody`, `generic-bizjet-small`, `cessna-high-wing`, `air-tractor-yellow`

### Phase 2 additions — 24 treatments / 48 images (40 / 80 cumulative)

`asa-narrowbody`, `jbu-narrowbody`, `fft-narrowbody`, `nks-narrowbody`, `aay-narrowbody`, `scx-narrowbody`, `hal-narrowbody`, `hal-widebody`, `aca-narrowbody`, `aca-widebody`, `wja-narrowbody`, `amx-narrowbody`, `voi-narrowbody`, `delta-connection-regional`, `united-express-regional`, `alaska-regional`, `netjets-bizjet`, `flexjet-bizjet`, `generic-bizjet-large`, `cessna-caravan`, `piper-low-wing`, `king-air`, `dash8`, `air-tractor-red-white`

### Phase 3 additions — 34 treatments / 68 images (74 / 148 cumulative)

`baw-widebody`, `dlh-widebody`, `afr-widebody`, `klm-widebody`, `fdx-trijet`, `ups-trijet`, `gti-widebody`, `dhl-widebody`, `dal-b717`, `dal-b757`, `ual-b787`, `aal-b777`, `dlh-b747`, `baw-a380`, `jbu-a220`, `jbu-e190`, `united-express-crj200`, `delta-connection-crj900`, `cirrus-low-wing`, `beech-piston`, `pilatus-pc12`, `daher-tbm`, `atr`, `generic-twin-piston`, `thrush-yellow-blue`, `crop-duster-green`, `bell-206`, `bell-407`, `h135-medical`, `police-helicopter`, `utility-helicopter`, `c130-military`, `c17-military`, `kc135-military`

> Count note: the second Air Tractor treatment is already a Phase 2 addition and is intentionally not repeated in Phase 3.

---

## Phase 0 — decisions and production foundation

### PG-001 — Approve the production art specification and 74-treatment matrix

**Milestone:** `Plane art — Phase 0: foundation`  
**Labels:** `plane-art`, `decision`, `manual-review`, `phase-0`  
**Depends on:** none

Resolve the five open decisions in Plan 2 before bulk generation creates expensive rework.

#### Scope

- Approve or revise the exact 74 treatment IDs, names, categories, shapes, and the phase allocation in this backlog.
- Choose `photorealistic` or `lightly polished photorealistic` as the single production style.
- Compare at least two viable background-removal methods on the existing Vertex proofs over the real sky photograph; record the chosen method and edge-quality rationale.
- Test candidate normalized canvases near 960 × 330 and WebP quality settings against hero and blip display sizes; record the selected dimensions, color-space rules, padding, baseline, and target byte range.
- Decide whether high-quality raw PNG masters are archived outside Git and document where/how, or explicitly accept committed WebPs plus prompts/metadata as the durable record.
- Confirm that branded generated artwork is acceptable for the intended site and that private registrations and exact local agency insignia remain prohibited.

#### Acceptance criteria

- [ ] Every open decision has an explicit recorded answer in `design/plane-art/README.md`.
- [ ] The Phase 1/2/3 allocations contain exactly 16, 24, and 34 unique additions and exactly 74 unique IDs overall.
- [ ] A signed-off visual reference set shows the chosen style, canvas, baseline, hero rendering, blip rendering, and alpha edges over the production sky.
- [ ] Measured example WebPs establish achievable dimensions, quality, and byte targets; exceptions require approval notes rather than silent quality loss.
- [ ] No production batch issue remains ambiguous about visual style or output contract.

---

### PG-002 — Define the versioned plane asset manifest and metadata contracts

**Milestone:** `Plane art — Phase 0: foundation`  
**Labels:** `plane-art`, `metadata`, `tooling`, `phase-0`  
**Depends on:** PG-001

Create the canonical, static data contracts for treatments, directional assets, mappings, fallbacks, prompts, provenance, and approvals.

#### Scope

- Establish `assets/planes/v1/manifest.js` as browser-safe static data with records for artwork ID, direction, URL, intrinsic dimensions, visual size class, applicable ICAO types, allowed callsign prefixes, fallback ID, prompt-record key, generation model, and approval state.
- Establish `design/plane-art/prompts.json` as development provenance with provider, project identifier (never credentials), pinned model ID, prompt, references, generation date, candidate/approval notes, and output linkage.
- Define controlled enums for direction, category, size class, and approval status.
- Keep untrusted API strings out of file paths; manifest URLs must be authored constants.
- Document how a future `v2` can coexist with cached `v1` files.

#### Acceptance criteria

- [ ] Contracts have example records for a branded jet, generic fallback, propeller aircraft, and both directions.
- [ ] Each directional asset has exactly one metadata record and one stable manifest key.
- [ ] Public manifest data contains no credential path, token, private key, Vertex SDK/runtime code, or unpublished raw candidate path.
- [ ] Fallbacks are cycle-free and terminate at a valid generic asset or the legacy SVG error fallback.
- [ ] Contract documentation explains which fields are hand-authored, generated, and validation-enforced.

---

### PG-003 — Build the 74-treatment prompt catalog and original shape-guide inventory

**Milestone:** `Plane art — Phase 0: foundation`  
**Labels:** `plane-art`, `metadata`, `generation`, `phase-0`  
**Depends on:** PG-001, PG-002

Prepare generation inputs for all treatments without spending Vertex generation budget yet.

#### Scope

- Add a prompt record for every treatment and direction, sharing approved global style constraints while preserving treatment-specific shape, engine/rotor count, gear, paint, and branding requirements.
- Inventory shape guides by aircraft family under `design/plane-art/shape-guides/`; record source/ownership and prohibit unlicensed model inputs.
- Require separate left generation, readable correctly oriented branding, full-aircraft crop, no scenery/watermark/shadow, and fictional-or-omitted private registrations.
- Add category-specific constraints for fixed gear, propellers, rotors, trijets, jumbo aircraft, crop dusters, generic emergency-service art, and neutral military art.
- Record a missing-guide status instead of silently substituting an incompatible silhouette.

#### Acceptance criteria

- [ ] All 74 IDs have complete right and left prompt definitions or a clearly blocked shape-guide task.
- [ ] Every reference file has provenance and permission notes.
- [ ] Prompts specify correct category and engine/rotor/propeller count.
- [ ] Left prompts reference the approved right result for style/livery consistency while still requesting an independent image.
- [ ] A script or test detects unknown IDs, missing prompt fields, missing reference files, and duplicate prompt keys.

---

### PG-004 — Implement a safe, selective, resumable Vertex batch generator

**Milestone:** `Plane art — Phase 0: foundation`  
**Labels:** `plane-art`, `tooling`, `generation`, `security`, `phase-0`  
**Depends on:** PG-002, PG-003

Evolve the proof workflow into `scripts/generate-plane-library.ps1` without making the frontend or GitHub Pages depend on Vertex.

#### Scope

- Accept explicit artwork IDs and `left`, `right`, or both directions; refuse an unqualified all-library run unless a deliberate confirmation flag is supplied.
- Support supplied service-account credential paths and Application Default Credentials without hard-coded filenames or secret output.
- Pin and record the selected current Vertex model ID, location, project ID, prompt revision, reference hashes, request time, and candidate count.
- Write raw candidates only beneath gitignored `.generated/plane-art/` and never overwrite approved outputs.
- Maintain a run ledger/checkpoint so retries skip completed requests unless `-Force` is explicit; show an estimated request count before generation.
- Sanitize errors and logs so access tokens, private keys, credential JSON, and authorization headers never appear.
- Make right approval a prerequisite/input for generating its paired left treatment.

#### Acceptance criteria

- [ ] A dry run lists exact IDs, directions, expected requests, inputs, outputs, and model without calling Vertex.
- [ ] One ID/one direction can be generated and resumed independently.
- [ ] Interrupted and repeated runs do not incur duplicate generation by default.
- [ ] Unknown IDs, missing prompts/guides, unsafe output paths, existing approved files, and missing authentication fail before paid requests.
- [ ] `.generated/plane-art/` is gitignored and no secret appears in normal or failure logs.
- [ ] The existing proof workflow remains usable or is explicitly superseded/documented.

---

### PG-005 — Implement deterministic alpha cleanup, normalization, and WebP encoding

**Milestone:** `Plane art — Phase 0: foundation`  
**Labels:** `plane-art`, `tooling`, `testing`, `phase-0`  
**Depends on:** PG-001, PG-002

Create `scripts/process-plane-art.mjs` to turn an approved raw master into a production-ready transparent WebP reproducibly.

#### Scope

- Apply the background-removal method approved in PG-001, including matte/halo cleanup and an explicit manual-repair input path.
- Normalize transparent crop, visual scale, baseline, padding, canvas dimensions, orientation, and color space without mirroring.
- Encode one production WebP per directional master using the approved quality settings and preserve fine edges/details.
- Emit dimensions, alpha/type checks, byte size, hashes, processing settings, and source linkage for metadata updates.
- Refuse to process ambiguous IDs/directions or overwrite an approved asset without an explicit replacement workflow.

#### Acceptance criteria

- [ ] Reprocessing identical input/settings produces the same pixels or a documented deterministic equivalent and stable metadata.
- [ ] Transparent corners, edge halos/fringing, clipping, canvas dimensions, baseline, and byte ceiling are machine-checked.
- [ ] Output paths are exactly `assets/planes/v1/<artwork-id>-<direction>.webp`.
- [ ] Left outputs are independently sourced and never created by mirroring right outputs.
- [ ] A proof pair renders cleanly over checkerboard and the production sky at hero and blip sizes.

---

### PG-006 — Add automated library integrity and safety validation

**Milestone:** `Plane art — Phase 0: foundation`  
**Labels:** `plane-art`, `testing`, `security`, `phase-0`  
**Depends on:** PG-002, PG-003, PG-005

Add a Node-based validation command and unit tests that fail before incomplete, unsafe, or mismapped plane assets ship.

#### Acceptance criteria

- [ ] Validate that every approved treatment has exactly one left and one right file and every approved metadata record has an image.
- [ ] Validate manifest URL, file existence, intrinsic dimensions, WebP type, alpha presence, canvas/byte ceilings, ID/direction naming, and prompt linkage.
- [ ] Validate that every ICAO/prefix mapping resolves to a known ID or explicit fallback and that fallback chains terminate.
- [ ] Detect duplicate/conflicting exact mappings and category contradictions such as a helicopter mapping to a jet.
- [ ] Fuzz unknown/hostile ICAO types, callsigns, airline names, and path-like strings; results must be authored generic assets only.
- [ ] Scan public modules/assets for credential material and Vertex runtime/SDK references.
- [ ] Expose an `npm` script suitable for local use and CI, with actionable failures.

---

## Phase 1 — prove the workflow and ship the first 32 images

### PG-007 — Build the development-only plane review gallery

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `frontend`, `manual-review`, `phase-1`  
**Depends on:** PG-002, PG-005

Create `design/plane-gallery.html` as the required visual acceptance surface for every batch.

#### Acceptance criteria

- [ ] Show every manifest treatment as adjacent right/left pairs with missing states made obvious.
- [ ] Show hero and blip sizes at climb, level, and descent tilts over both the production sky and checkerboard alpha view.
- [ ] Display filename, byte size, mapping summary, dimensions, model, prompt key, and approval status.
- [ ] Filter by airline, cargo, general aviation, crop duster, helicopter, and military category.
- [ ] Load production assets/manifest directly and remain clearly development-only (not linked from the public homepage).
- [ ] Include a concise manual reject checklist matching Plan 2 and a place to record approval notes.

---

### PG-008 — Produce and approve Phase 1 mainline passenger pairs (14 images)

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-1`  
**Depends on:** PG-004, PG-005, PG-007

Generate, process, and manually approve both directions for: `aal-narrowbody`, `aal-widebody`, `ual-narrowbody`, `ual-widebody`, `dal-narrowbody`, `dal-widebody`, and `swa-narrowbody`.

#### Acceptance criteria

- [ ] Fourteen independently generated, processed WebPs exist with complete provenance and approval notes.
- [ ] Primary wordmarks and tail branding are recognizable and correctly oriented; category, anatomy, engine count, crop, baseline, and alpha edges pass review.
- [ ] Each pair looks like one family/livery without requiring pixel identity.
- [ ] Every pair is approved in the gallery at hero and blip sizes on the production sky.
- [ ] Rejected candidates remain outside committed production assets and do not count toward completion.

---

### PG-009 — Produce and approve Phase 1 cargo, regional, and generic pairs (12 images)

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-1`  
**Depends on:** PG-004, PG-005, PG-007

Generate, process, and manually approve both directions for: `fdx-widebody`, `ups-widebody`, `american-eagle-regional`, `generic-regional`, `generic-narrowbody`, and `generic-widebody`.

#### Acceptance criteria

- [ ] Twelve independently generated, processed WebPs exist with complete provenance and approval notes.
- [ ] Cargo/mainline branding is readable and correctly oriented; neutral fallbacks are attractive but not falsely branded.
- [ ] Regional art is used only where partnership confidence permits; `generic-regional` is visually production-ready.
- [ ] All Plan 2 anatomy, crop, alpha, baseline, hero, and blip review gates pass.

---

### PG-010 — Produce and approve Phase 1 business, light-aircraft, and agricultural pairs (6 images)

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-1`  
**Depends on:** PG-004, PG-005, PG-007

Generate, process, and manually approve both directions for: `generic-bizjet-small`, `cessna-high-wing`, and `air-tractor-yellow`.

#### Acceptance criteria

- [ ] Six independently generated, processed WebPs exist with complete provenance and approval notes.
- [ ] Silhouette, propeller/engine count, landing-gear treatment, and relative visual scale match the assigned family.
- [ ] No artwork intentionally reproduces a real private owner's registration.
- [ ] Each asset remains recognizable at blip size and passes alpha/crop/baseline review.

---

### PG-011 — Freeze Phase 1 production settings after the 32-image visual gate

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `decision`, `manual-review`, `performance`, `phase-1`  
**Depends on:** PG-008, PG-009, PG-010

Review the complete first batch before spending on the remaining 116 images and freeze or deliberately revise the production recipe.

#### Acceptance criteria

- [ ] All 16 right/left pairs are reviewed together for camera angle, daylight, scale, padding, baseline, and pair consistency.
- [ ] Actual dimensions and byte distributions are reported, including exceptions outside the 40–110 KB target.
- [ ] Alpha quality is inspected over the production sky and checkerboard; background-removal failures are repaired.
- [ ] The selected model ID, prompt revision, processing settings, canvas, WebP quality, and approval rubric are frozen in documentation.
- [ ] Any recipe change is applied to the full Phase 1 batch before Phase 2 generation begins.
- [ ] The library validator passes for all Phase 1 assets.

---

### PG-012 — Implement the pure aircraft-family and artwork resolver

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `frontend`, `testing`, `phase-1`  
**Depends on:** PG-002, PG-006, PG-011

Add pure, DOM-free `planeFamily(icaoType, aircraftClass)`, `planeArtwork(aircraft)`, and `planeAsset(artworkId, direction)` behavior backed only by reviewed static tables.

#### Scope and precedence

1. Exact airline/cargo brand plus compatible family.
2. Branded regional art only when the operating partnership is known.
3. Exact special-aircraft family.
4. Branded nearest compatible family.
5. Generic family fallback.
6. Legacy SVG only as an image-load error fallback during rollout.

#### Acceptance criteria

- [ ] Resolver output is deterministic, side-effect-free, and contains no image bytes or dynamic path construction.
- [ ] Callsigns/ICAO types are normalized and looked up in authored allowlists; unknown or hostile strings cannot influence URLs.
- [ ] Incompatible combinations fall back by family rather than showing a confidently wrong brand/category.
- [ ] Direction comes from existing `planePose` heading logic and selects an independent `left` or `right` manifest record.
- [ ] Table-driven tests cover every Phase 1 mapping, precedence branch, null/unknown input, hostile strings, and fallbacks.

---

### PG-013 — Replace selected-flight SVG swapping with directional WebP rendering

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `frontend`, `testing`, `phase-1`  
**Depends on:** PG-012

Update the selected hero aircraft to use an `<img>` while preserving the route layout, heading, tilt, selection, animation, and accessibility behavior.

#### Acceptance criteria

- [ ] The selected plane sets only manifest-authored `src`, intrinsic `width`/`height`, useful nonverbal accessibility treatment, `decoding="async"`, and high fetch priority.
- [ ] The above-the-fold image is not lazy-loaded and its reserved box causes no layout shift.
- [ ] CSS horizontal mirroring is removed; left traffic requests the left file and right traffic requests the right file.
- [ ] Pose tilt remains correct for both directions and existing route/selection tests continue to pass.
- [ ] Missing/broken WebP loads the appropriate legacy jet/prop SVG without leaving an empty route or retry loop.
- [ ] Switching selected flights does not flash stale branding or corrupt animation state.

---

### PG-014 — Render background traffic blips from the same directional asset library

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `frontend`, `performance`, `phase-1`  
**Depends on:** PG-012, PG-013

Replace dynamically created blip SVGs with the same production WebPs, retaining keyed DOM reuse, placement, clicking, limits, and pose behavior.

#### Acceptance criteria

- [ ] Each visible blip loads only its resolved direction and uses the same URL as the hero for browser-cache reuse.
- [ ] Keyed nodes survive refresh movement without unnecessary image reloads or recreation.
- [ ] Narrow-screen limits, click selection, avoidance boxes, opacity, tilt, and light-aircraft sizing remain correct.
- [ ] No CSS mirroring remains for plane artwork.
- [ ] An image failure falls back to the category-appropriate legacy SVG and remains selectable.
- [ ] No small derivative assets are introduced until PG-017 measures a need.

---

### PG-015 — Add browser-level image loading, fallback, switching, and caching tests

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `testing`, `frontend`, `phase-1`  
**Depends on:** PG-013, PG-014

Add automated browser coverage around behavior that unit tests cannot prove.

#### Acceptance criteria

- [ ] Cover successful hero/blip loads for both directions and at least jet, propeller, and generic fallback families.
- [ ] Cover missing/corrupt files and verify category-appropriate SVG fallback with no empty route.
- [ ] Cover carousel switching, blip promotion, refresh reconciliation, and keyed blip reuse.
- [ ] Assert that selected and visible unique blip assets are requested, unused airlines are not requested, and repeated URLs are cache-reused.
- [ ] Assert no full-library preload and no layout shift attributable to plane loading.
- [ ] Existing Node test suite remains green.

---

### PG-016 — Document and release the Phase 1 library

**Milestone:** `Plane art — Phase 1: 32 images`  
**Labels:** `plane-art`, `documentation`, `phase-1`  
**Depends on:** PG-011, PG-013, PG-014, PG-015

Make the first production slice maintainable and verify that the public site has no generation-time dependency.

#### Acceptance criteria

- [ ] `design/plane-art/README.md` documents generation, candidate review, processing, approval, replacement, validation, and raw-master archival workflows.
- [ ] Root documentation describes static WebP rendering and no longer claims the aircraft are solely original SVG illustrations.
- [ ] A clean checkout can run tests and serve approved assets without Google credentials, Vertex availability, billing, or SDKs.
- [ ] Exactly 16 approved treatments / 32 directional production WebPs are present and validator/tests pass.
- [ ] Phase 1 cold-cache behavior is captured as the baseline for later phases.

---

## Phase 2 — expand to 40 treatments / 80 images

### PG-017 — Measure Phase 1 cold-cache and mobile performance before expansion

**Milestone:** `Plane art — Phase 2: 80 images`  
**Labels:** `plane-art`, `performance`, `testing`, `phase-2`  
**Depends on:** PG-016

Measure rather than assume whether one shared hero/blip WebP is still the right delivery strategy.

#### Acceptance criteria

- [ ] Record cold and warm loads on a throttled mobile profile for one, four, and eight visible aircraft with duplicate and unique assets.
- [ ] Confirm a typical first view transfers no more than the selected plane plus visible unique blips and requests no unused treatment.
- [ ] Confirm cache reuse during selection changes and blip promotion.
- [ ] Report layout shift, image bytes, request count, decode/render behavior, and subjective usability.
- [ ] Keep the one-file strategy if gates pass; if not, open a separately justified derivative-image issue with measured thresholds and expected savings.
- [ ] Optional idle prefetch, if implemented, is limited to previous/next after current load and is measured separately; full-library preload is prohibited.

---

### PG-018 — Produce and approve Phase 2 North American airline pairs (26 images)

**Milestone:** `Plane art — Phase 2: 80 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-2`  
**Depends on:** PG-011, PG-017

Generate, process, and approve both directions for: `asa-narrowbody`, `jbu-narrowbody`, `fft-narrowbody`, `nks-narrowbody`, `aay-narrowbody`, `scx-narrowbody`, `hal-narrowbody`, `hal-widebody`, `aca-narrowbody`, `aca-widebody`, `wja-narrowbody`, `amx-narrowbody`, and `voi-narrowbody`.

#### Acceptance criteria

- [ ] Twenty-six independent directional WebPs pass the frozen production recipe and manual reject rubric.
- [ ] Branding, aircraft family, pair consistency, metadata, and gallery review are complete.
- [ ] Any justified recipe exception is recorded per asset and does not silently redefine the global standard.

---

### PG-019 — Produce and approve Phase 2 regional partner pairs (6 images)

**Milestone:** `Plane art — Phase 2: 80 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-2`  
**Depends on:** PG-011, PG-017

Generate, process, and approve both directions for: `delta-connection-regional`, `united-express-regional`, and `alaska-regional`.

#### Acceptance criteria

- [ ] Six independent directional WebPs pass production and gallery review.
- [ ] Resolver data uses these only where the operating partnership is confidently known; ambiguous regional traffic remains generic.
- [ ] Shape/family mappings distinguish compatible regional jets from mainline narrowbodies.

---

### PG-020 — Produce and approve Phase 2 business, GA, turboprop, and agricultural pairs (16 images)

**Milestone:** `Plane art — Phase 2: 80 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-2`  
**Depends on:** PG-011, PG-017

Generate, process, and approve both directions for: `netjets-bizjet`, `flexjet-bizjet`, `generic-bizjet-large`, `cessna-caravan`, `piper-low-wing`, `king-air`, `dash8`, and `air-tractor-red-white`.

#### Acceptance criteria

- [ ] Sixteen independent directional WebPs pass production and gallery review.
- [ ] Branded business jets are distinct from neutral fallbacks; no real private registration is intentionally reproduced.
- [ ] Propeller/engine counts, fixed/retracted gear, silhouette, baseline, and relative size are appropriate.

---

### PG-021 — Expand mappings and pass the Phase 2 40-treatment release gate

**Milestone:** `Plane art — Phase 2: 80 images`  
**Labels:** `plane-art`, `metadata`, `testing`, `manual-review`, `phase-2`  
**Depends on:** PG-018, PG-019, PG-020

#### Acceptance criteria

- [ ] Manifest, prompts, ICAO family tables, callsign prefixes, category data, and fallbacks include all Phase 2 treatments.
- [ ] New mappings have table-driven positive, incompatible-family, ambiguous-regional, unknown, and hostile-input tests.
- [ ] Gallery review compares all 40 pairs for consistency and repairs outliers.
- [ ] Exactly 40 treatments / 80 directional WebPs are approved; metadata/image parity and all validators/tests pass.
- [ ] Re-run performance smoke checks and confirm library growth did not increase initial downloads for unchanged visible traffic.

---

## Phase 3 — complete 74 treatments / 148 images

### PG-022 — Produce and approve Phase 3 international, cargo, and special airliner pairs (36 images)

**Milestone:** `Plane art — Phase 3: 148 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-3`  
**Depends on:** PG-021

Generate, process, and approve both directions for: `baw-widebody`, `dlh-widebody`, `afr-widebody`, `klm-widebody`, `fdx-trijet`, `ups-trijet`, `gti-widebody`, `dhl-widebody`, `dal-b717`, `dal-b757`, `ual-b787`, `aal-b777`, `dlh-b747`, `baw-a380`, `jbu-a220`, `jbu-e190`, `united-express-crj200`, and `delta-connection-crj900`.

#### Acceptance criteria

- [ ] Thirty-six independent directional WebPs pass production and gallery review.
- [ ] Distinctive engine counts, rear-engine/trijet/jumbo shapes, scale classes, and branded wordmarks are correct.
- [ ] Exact special-family mappings outrank broader branded-family mappings when compatible.

---

### PG-023 — Produce and approve remaining Phase 3 GA and turboprop pairs (12 images)

**Milestone:** `Plane art — Phase 3: 148 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-3`  
**Depends on:** PG-021

Generate, process, and approve both directions for: `cirrus-low-wing`, `beech-piston`, `pilatus-pc12`, `daher-tbm`, `atr`, and `generic-twin-piston`.

#### Acceptance criteria

- [ ] Twelve independent directional WebPs pass production and gallery review.
- [ ] Single/twin-engine and piston/turboprop silhouettes, gear, scale, and generic/private-registration constraints are correct.

---

### PG-024 — Produce and approve Phase 3 crop-duster and helicopter pairs (14 images)

**Milestone:** `Plane art — Phase 3: 148 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-3`  
**Depends on:** PG-021

Generate, process, and approve both directions for: `thrush-yellow-blue`, `crop-duster-green`, `bell-206`, `bell-407`, `h135-medical`, `police-helicopter`, and `utility-helicopter`.

#### Acceptance criteria

- [ ] Fourteen independent directional WebPs pass production and gallery review.
- [ ] Rotors, landing gear, agricultural equipment, silhouettes, direction, and scale are anatomically credible.
- [ ] Police, medical, and utility art communicates category without exact local insignia or invented official affiliation.

---

### PG-025 — Produce and approve Phase 3 military pairs (6 images)

**Milestone:** `Plane art — Phase 3: 148 images`  
**Labels:** `plane-art`, `generation`, `manual-review`, `phase-3`  
**Depends on:** PG-021

Generate, process, and approve both directions for: `c130-military`, `c17-military`, and `kc135-military`.

#### Acceptance criteria

- [ ] Six independent directional WebPs pass production and gallery review.
- [ ] Each silhouette, engine count, scale, and role is recognizable while treatment remains neutral U.S. military gray without a false unit affiliation.

---

### PG-026 — Complete mappings, audit local traffic gaps, and release all 148 images

**Milestone:** `Plane art — Phase 3: 148 images`  
**Labels:** `plane-art`, `metadata`, `testing`, `performance`, `manual-review`, `phase-3`  
**Depends on:** PG-022, PG-023, PG-024, PG-025

Finish the planned library and prove that breadth does not change on-demand loading behavior.

#### Acceptance criteria

- [ ] Manifest, prompts, ICAO/callsign mappings, categories, size classes, and fallbacks cover all 74 treatments.
- [ ] Full gallery review compares all pairs and all categories at both display sizes and three tilts; every rejected outlier is repaired or explicitly unapproved.
- [ ] Exactly 74 treatments / 148 independently generated directional masters are approved and committed.
- [ ] All integrity, resolver, pose, browser, fallback, switching, caching, and hostile-input tests pass.
- [ ] A representative local/demo traffic sample is resolved and obvious frequent gaps are documented for Phase 4 rather than added ad hoc.
- [ ] Cold-cache checks confirm unused library files are not requested and the page remains pleasant on throttled mobile.
- [ ] Documentation records final counts, model/prompt revisions, processing settings, known limitations, and replacement procedure.

---

## Phase 4 — optional evidence-based growth

### PG-027 — Review observed traffic and add no more than six justified treatments

**Milestone:** `Plane art — Phase 4: observed growth`  
**Labels:** `plane-art`, `decision`, `generation`, `performance`, `phase-4`  
**Depends on:** PG-026

Use observed real traffic—not theoretical completeness—to decide whether the library should grow. Closing this issue with no additions is a valid outcome.

#### Scope

- Analyze a privacy-safe aggregate/sample of unresolved or generic-fallback traffic around the farm.
- Rank candidates by frequency, visual distinctiveness, mapping confidence, and whether an existing fallback is misleading.
- Approve zero to six new treatments (zero to twelve independent directional images).
- Run the same prompt, generation, processing, metadata, manual gallery, mapping, validation, browser, and performance gates as the planned library.
- Stop at 160 approved masters. Any proposal beyond 160 requires a new architecture/value/repository/download review and is outside this issue.

#### Acceptance criteria

- [ ] The decision report identifies the observation period, candidate counts, existing fallbacks, and rationale for every addition or rejection.
- [ ] Each added treatment represents a frequent missing brand or genuinely new silhouette and has both independently generated directions.
- [ ] Total approved masters remain at or below 160 and initial download behavior remains demand-driven.
- [ ] Manifest versioning/caching remains valid; replace `v1` only according to the documented replacement policy or create `v2` deliberately.
- [ ] All validators, mapping tests, browser tests, gallery review, and documentation updates pass.

---

## Dependency summary

```text
PG-001 decisions
├─ PG-002 contracts ─┬─ PG-003 prompts/guides ─ PG-004 generator
│                    ├─ PG-005 processing ─ PG-006 validation
│                    └─ PG-007 gallery
└──────────────────────────────────────────────────────────────┐
                                                               ▼
PG-008 + PG-009 + PG-010 artwork ─ PG-011 Phase 1 visual gate
                                      │
                                      ├─ PG-012 resolver ─ PG-013 hero ─ PG-014 blips
                                      │                              └──────┬──────┘
                                      │                                     ▼
                                      └───────────────────────────────── PG-015 tests
                                                                             │
                                                                             ▼
                                                                       PG-016 release
                                                                             │
                                                                             ▼
                                                                       PG-017 measure
                                                                             │
                         ┌───────────────────────────────────────────────────┼───────────────┐
                         ▼                                                   ▼               ▼
                      PG-018                                              PG-019          PG-020
                         └───────────────────────────────────────────────────┼───────────────┘
                                                                             ▼
                                                                       PG-021 release
                                                                             │
                         ┌───────────────────────────┬───────────────────────┼───────────────┐
                         ▼                           ▼                       ▼               ▼
                      PG-022                      PG-023                  PG-024          PG-025
                         └───────────────────────────┴───────────────────────┼───────────────┘
                                                                             ▼
                                                                       PG-026 release
                                                                             │
                                                                             ▼
                                                                       PG-027 optional
```

## Global definition of done for every artwork-production issue

- Both directions are independently generated; neither is a mirrored derivative.
- The primary wordmark, direction, aircraft category, anatomy, engine/rotor/propeller count, crop, baseline, alpha, and display-size recognition pass manual review.
- Tiny plausible incidental lettering alone is not a rejection reason.
- Raw candidates stay in `.generated/plane-art/` or the approved external archive; only approved processed production assets are committed.
- Metadata and approval notes are complete, validator passes, and no credentials or tokens are logged or committed.
- A rejected candidate never counts toward the milestone image total.
