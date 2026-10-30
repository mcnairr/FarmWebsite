# Plane artwork production specification

Status: **approved for production** on 2026-10-29 by implementation of
[PG-001](https://github.com/mcnairr/FarmWebsite/issues/1). This file is the
decision record for every production batch. A later change requires an approval
note here before assets are regenerated.

## Approved treatment matrix and phases

The 74 IDs, display names/treatments, categories, and aircraft shapes are
approved **without revision** exactly as listed in the three tables under
“Planned artwork matrix” in [`../plane-graphics-plan2.md`](../plane-graphics-plan2.md).
Those tables are the canonical name/category/shape inventory; an ID must not be
renamed or moved to a different shape by a batch issue.

The exact phase allocation is approved **without revision** as listed under
“Locked treatment allocation for issue planning” in
[`../plane-graphics-issues.md`](../plane-graphics-issues.md):

- Phase 1: 16 unique treatments / 32 directional images.
- Phase 2: 24 unique additions (40 cumulative) / 48 new images.
- Phase 3: 34 unique additions (74 cumulative) / 68 new images.

The automated PG-001 test parses both sources and enforces 16 + 24 + 34 = 74
unique IDs, as well as 47 scheduled/cargo, 15 business/GA/turboprop, and 12
crop-duster/helicopter/military rows. This preserves the written requirements
as the source instead of copying a second matrix that could drift.

## Visual style

The single production style is **lightly polished photorealistic**. Aircraft
must retain believable materials, anatomy, proportions, daylight, and camera
perspective, while allowing restrained cleanup of reflections, paint, and
surface detail so the 148-image set feels consistent. “Polished” does not permit
illustration, toy-like forms, heavy HDR, exaggerated saturation, or a synthetic
icon finish. The existing American and Southwest Vertex proofs are the signed-off
style references.

## Background removal and alpha edges

Two reproducible methods were compared on all four Vertex proofs:

1. **Global white key:** converts every near-white pixel to alpha. It produces a
   small file and a clean outer silhouette, but removes or weakens legitimate
   white fuselage highlights, windows, and livery detail that are not background.
2. **Edge-connected white matte:** flood-fills near-white pixels only when they
   connect to the source canvas edge, then unmattes partial pixels against white.
   It preserves enclosed highlights and fine pale detail while removing the
   white fringe at the silhouette.

The selected production method is **edge-connected white matte**. Its extra
2–4 KB on the pale American examples is accepted because its retained white
detail and more stable edge opacity look better over the production sky. A
global key is not an approved fallback. If the selected method leaves a halo,
damages a bright surface connected to the background, or cannot separate an
object, route the master through documented manual mask repair and record that
exception; do not silently increase thresholds.

[`reference/alpha-method-comparison.png`](reference/alpha-method-comparison.png)
is the signed-off visual reference. It shows both methods over the actual
`Oats.jpg` sky at the current CSS maximum hero width (272 px) and standard blip
width (46 px), plus enlarged checkerboard alpha inspection. The American proof
is the primary sign-off image; all four proofs are included in the byte and
encoding measurements.

## Normalization and encoding contract

- Canvas: **960 × 330 physical pixels**, transparent RGBA.
- Color: convert input to **sRGB IEC 61966-2-1**; strip source orientation and
  unrelated metadata. Do not ship Display P3 or an untagged non-sRGB conversion.
- Crop and scale: trim fully transparent source area, scale proportionally inside
  an 888 × 270 content box, and never enlarge a smaller approved master.
- Padding: center horizontally with at least **36 px left/right**; preserve at
  least **20 px top** and **40 px below the baseline**. More top padding is normal
  when the width constraint determines scale.
- Baseline: the lowest nontransparent aircraft pixel sits at **y = 289**; the
  baseline coordinate is **290** using a zero-based canvas. This is invariant
  across treatments. Do not stretch an aircraft to reach it.
- WebP: lossy **quality 90**, alpha quality 100, smart chroma subsampling, encoder
  effort 4. Keep one production file for both hero and blip rendering.
- Target: **40–110 KB (40,000–110,000 bytes) per directional WebP**. A result outside that inclusive
  range requires a dated approval note naming the asset, measured bytes, visual
  reason, and approver. Never lower quality or change dimensions silently.

Measured selected-method results at quality 90:

| Proof | Bytes | KiB |
|---|---:|---:|
| American branded | 50,466 | 49.3 |
| American inspired | 47,356 | 46.2 |
| Southwest branded | 43,206 | 42.2 |
| Southwest inspired | 40,904 | 39.9 |

All four meet the selected range. The tested quality 78 results were 30,142–
41,642 bytes and quality 84 results were 34,490–45,004 bytes; both settings put
valid examples below the 40 KB floor. The full per-file results and computed
bounds are in [`reference/measurements.json`](reference/measurements.json).
Rebuild the evidence with `npm run plane-art:reference`.

## Durable record and raw masters

There is **no external raw-PNG archive requirement**. The durable production
record is the committed approved WebP plus its complete prompt, provider/model,
reference hashes, processing settings, generation date, approval notes, and
output hash in project metadata. Raw candidates and high-quality working PNGs
belong under gitignored `.generated/plane-art/` and may be discarded after the
WebP and metadata are reviewed and committed. Existing proof PNGs remain
committed design references, not production masters.

This decision accepts that an identical raw generation may not be recoverable
after a model is retired; the reviewed WebP is the master that the site must be
able to reproduce and serve. A future batch may add an external archive only
after its owner, location, access, retention, and restore test are documented.

## Branding and prohibited identity details

Branded generated artwork is approved for this farm flight-information site,
subject to human review for recognizable, correctly oriented primary branding
and an accurate aircraft family. Approval here is a project art-direction
decision, not a claim of airline endorsement or legal advice.

Private-aircraft registration numbers must be fictional or omitted and must not
intentionally reproduce a real private registration. Police, medical, utility,
and military artwork must remain generic: never copy an exact local agency
insignia, badge, unit mark, or invent an official-looking affiliation. These are
hard rejection rules for every batch.

## Batch output contract

Every production batch therefore uses the approved matrix and phase, lightly
polished photorealism, independently generated left/right views, the selected
edge-connected matte (or recorded manual repair), the 960 × 330 normalization
contract, quality-90 WebP encoding, and the 40–110 KB approval gate. Generated
art is never published automatically; visual approval over the production sky
and checkerboard remains mandatory.
