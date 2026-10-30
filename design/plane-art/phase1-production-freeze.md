# Phase 1 production recipe freeze (PG-011)

Status: **frozen after the October 30, 2026 review repair pass** and the complete
16-pair / 32-image gate. Phase 2 generation must use this recipe unless a later
decision record deliberately revises it and applies the revision consistently
to every affected batch.

## Gate evidence and outcome

All 16 independently generated right/left pairs were reviewed together in the
development gallery at the production 272 px hero and 46 px blip sizes, at
climb, level, and descent tilts, over both `Oats.jpg` and checkerboard. The
consolidated review covered camera angle, daylight, relative scale, padding,
baseline, anatomy, branding or neutral treatment, silhouette recognition, pair
consistency, and alpha edges.

The first complete review rejected ten directions because their upper surfaces
looked dark and smoke-damaged: `aal-narrowbody:right`,
`american-eagle-regional:right`, `dal-narrowbody:left`, both `dal-widebody`
directions, `fdx-widebody:left`, both `generic-narrowbody` directions, and both
`generic-widebody` directions. Each was corrected and reprocessed before this
freeze. A generated clean-lighting reference supplied only a median luminance
target; [`../../scripts/repair-plane-lighting.mjs`](../../scripts/repair-plane-lighting.mjs)
applied a deterministic correction to low-saturation upper-surface pixels while
retaining the original RGB detail, geometry, branding, text, and alpha as the
production source. The repair provenance and old/new hashes are recorded in
the ten corresponding `prompts.json` records.

After that repair, all pairs pass. Natural three-quarter-perspective differences remain visible in
the regional and light-aircraft pairs, but they retain the assigned family,
daylight, scale class, and treatment and do not cross a reject threshold. The
production-sky and checkerboard review found no remaining opaque corner, white
box, matte halo, clipping, or severe color-fringe failure. Seven outputs used
the already documented alpha-only manual-repair path: `aal-narrowbody:left`,
`dal-narrowbody:right`, `fdx-widebody:right`, both `generic-regional`
directions, and both `generic-bizjet-small` directions. Their aircraft masters
and output hashes remain linked in `prompts.json`; no additional repair was
needed beyond the recorded alpha and lighting repairs.

| Treatment | Right bytes | Left bytes | Consolidated pair result |
|---|---:|---:|---|
| `aal-narrowbody` | 47,138 | 40,946 | Pass after right-side lighting repair — angle, livery, scale, baseline, and alpha agree. |
| `aal-widebody` | 29,274† | 32,142† | Pass — matching widebody family; both below-range exceptions retained. |
| `ual-narrowbody` | 52,284 | 56,264 | Pass — matching narrowbody family and daylight treatment. |
| `ual-widebody` | 52,444 | 50,984 | Pass — matching widebody family, livery, padding, and alpha. |
| `dal-narrowbody` | 39,216† | 60,564 | Pass after left lighting repair — pair remains coherent after the right alpha-only repair. |
| `dal-widebody` | 52,428 | 53,070 | Pass after both lighting repairs — matching family, livery, camera treatment, and scale. |
| `swa-narrowbody` | 37,854† | 36,478† | Pass — matching Heart livery and silhouette; exceptions retained. |
| `fdx-widebody` | 38,712† | 51,366 | Pass after left lighting repair — readable branding and clean repaired right alpha. |
| `ups-widebody` | 44,678 | 48,048 | Pass — matching cargo family, branding, and baseline. |
| `american-eagle-regional` | 45,976 | 42,602 | Pass after right lighting repair — natural angle difference accepted; family and treatment agree. |
| `generic-regional` | 33,172† | 35,444† | Pass — neutral pair with clean repaired alpha; exceptions retained. |
| `generic-narrowbody` | 48,328 | 52,034 | Pass after both lighting repairs — neutral treatment, family, scale, and alpha agree. |
| `generic-widebody` | 49,674 | 45,050 | Pass after both lighting repairs — neutral treatment and widebody silhouette agree. |
| `generic-bizjet-small` | 31,836† | 31,962† | Pass — compact rear-engine family and repaired alpha agree. |
| `cessna-high-wing` | 52,350 | 48,486 | Pass — natural angle difference accepted; high-wing/gear treatment agrees. |
| `air-tractor-yellow` | 67,254 | 70,972 | Pass — matching agricultural anatomy, scale, gear, and yellow treatment. |

† Approved below the 40,000-byte target; the dated per-asset visual reason is
recorded in the corresponding `prompts.json` approval note. No asset exceeds
the 110,000-byte ceiling.

## Measured production distribution

`npm run plane-art:audit-phase1` reads the committed manifest, prompt records,
and WebPs and reproduces these measurements:

| Measurement | Result |
|---|---:|
| Directional images | 32 |
| Intrinsic dimensions | 32 at 960 × 330 |
| Total bytes | 1,479,030 |
| Minimum | 29,274 |
| 25th percentile | 38,498 |
| Median | 47,593 |
| Mean | 46,220 |
| 75th percentile | 52,301 |
| Maximum | 70,972 |
| Inside 40,000–110,000 bytes | 22 |
| Below target with approval notes | 10 |
| Above target | 0 |

All 32 files are WebP with alpha and transparent corners. Every nontransparent
bound ends on y=289, leaving 40 px below it; the batch minimums are 36 px left,
36 px right, and 20 px top. These values satisfy the normalized canvas,
padding, and baseline contract exactly.

## Frozen Phase 2 production recipe

Generation:

- Provider: **Google Cloud Vertex AI**.
- Model ID: **`gemini-3.1-flash-image`**.
- Prompt revision: Phase 1 source provenance remains **v1**. All future requests
  use effective revision **`v1+pg011-lighting-1`**: the exact per-direction v1
  record, shared constraints `global-1` through `global-5`, category constraints,
  and the catalog's frozen clean-even-upper-surface amendment. The generator
  includes the amendment in the request hash, dry-run plan, and metadata.
- Style: lightly polished photorealistic, believable clean even daylight with
  no smoky, soot-like, burned, dirty, or unnaturally dark upper-surface cast, mostly
  side-on three-quarter camera, one full aircraft, pure-white removable
  background, and no scenery, watermark, shadow, or cropped parts.
- Requests: one candidate per request, `TEXT` plus `IMAGE` response modalities,
  16:9 image configuration, global location preferred with a recorded regional
  location permitted only for capacity. Every request records actual project,
  model, location, time, prompt hash, references, and candidate hash.
- Directions: generate right independently first; generate left independently
  from its own prompt with the approved right result used only as a style/livery
  reference. Never mirror or flip.

Processing and encoding:

- Background removal: edge-connected white matte; use the recorded manual
  alpha-repair input only when automatic cleanup damages or cannot separate the
  aircraft. Do not tune thresholds per asset.
- Review-guided lighting repair: if a reviewer rejects a smoke-like dark cast,
  create a clean-lighting reference and run `npm run plane-art:repair-lighting`
  against the original normalized asset. The script may lift only neutral
  upper-surface luminance; it must preserve geometry and alpha exactly. Record
  source, reference, corrected PNG, and output hashes in `prompts.json`, then
  re-run the normal processor and full visual gate. This is a rejection repair,
  not an automatic step or permission to relight colored branding.
- Color: sRGB IEC 61966-2-1 with unrelated metadata and source orientation
  removed.
- Canvas: transparent **960 × 330** RGBA; proportional fit within **888 × 270**;
  no enlargement.
- Placement: centered, minimum 36 px horizontal and 20 px top padding,
  nontransparent bottom at y=289, and 40 px below the baseline.
- WebP: lossy quality **90**, alpha quality **100**, smart subsampling enabled,
  encoder effort **4**.
- Byte gate: 40,000–110,000 inclusive. An exception requires a dated per-asset
  approval note; settings must not be silently changed to hit the range.

Approval rubric:

- Reject a wrong direction, backwards or unreadable primary branding, wrong
  family/category, malformed anatomy, wrong engine/propeller/rotor/gear count,
  extreme pair scale or angle mismatch, bad crop or baseline, clipping, opaque
  corners, matte halos, severe fringing, watermark/scenery, copied private
  registration or local insignia, poor hero recognition, or an ugly blip
  silhouette.
- Do not reject solely for tiny plausible incidental lettering, minor panel
  inventions, or small natural differences between independently generated
  directions.
- Approval requires the adjacent pair at all three tilts and both production
  sizes on the production sky and checkerboard, plus passing automated library
  validation. Generation and processing never approve or publish an asset.

## Recipe-change decision and exit check

The complete gate added one recipe amendment: reject smoky/dark upper-surface
casts and permit the constrained, alpha-preserving lighting-repair workflow
above. The amendment was applied to the full Phase 1 batch by screening all 32
images; the ten rejected directions were corrected and reprocessed before the
freeze. The other 22 already met the amended daylight rule and were not changed.
The alpha repairs and ten byte-range exceptions remain asset-specific reviewed
outcomes, not alternate recipes.

At freeze time, `npm run plane-art:validate` reports 32 manifest records and 32
approved images, and the complete `npm test` suite passes. Run both commands,
plus `npm run plane-art:audit-phase1`, before starting or approving a Phase 2
batch.
