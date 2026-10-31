# Plane artwork production specification

Status: **approved for production** on 2026-10-29 by implementation of
[PG-001](https://github.com/mcnairr/FarmWebsite/issues/1). This file is the
decision record for every production batch. A later change requires an approval
note here before assets are regenerated.

The complete Phase 1 visual gate froze this recipe on 2026-10-30 under
[PG-011](https://github.com/mcnairr/FarmWebsite/issues/11), after adding a
reviewer-driven rejection rule and deterministic repair for smoke-like dark
upper-surface shading.
The consolidated 16-pair review, byte distribution, exceptions, alpha results,
approval rubric, and exact Phase 2 freeze are recorded in
[`phase1-production-freeze.md`](phase1-production-freeze.md).

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

### Chroma-background transparency workflow

Issue [#18](https://github.com/mcnairr/FarmWebsite/issues/18) demonstrated that
a white aircraft on a white generated background can defeat the standard
edge-connected white matte: the flood fill may cross a pale boundary and erase
the upper fuselage, cockpit, or nose. Do not approve or hand-paint around that
damage.

When a batch has a recorded chroma exception, generation uses a perfectly
uniform, fully saturated background that contrasts with every protected livery
color. Phase 2 North American airline pairs use magenta (`#FF00FF`) because
Frontier and several peers contain green. The exception must name every affected
prompt record and remains subordinate to the frozen direction, anatomy,
branding, lighting, crop, and independent-pair requirements.

Extract a generated candidate before normal production processing:

```powershell
npm run plane-art:chroma -- --input <candidate.png> --output <transparent.png> --color magenta
node scripts/process-plane-art.mjs --artwork-id <id> --direction <direction> --input <candidate.png> --source-metadata <metadata.json> --manual-repair <transparent.png> --proof <proof.png>
```

The extractor flood-fills only edge-connected chroma pixels, unmattes
antialiased edges against the exact background color, and replaces translucent
edge RGB with the nearest fully opaque aircraft color to remove color spill.
It never mirrors, redraws, or changes aircraft geometry. Review the result on
the production sky and checkerboard at hero and blip sizes. Reject wrong
direction, malformed anatomy, a missing or ambiguous engine, residual chroma
fringe, transparent aircraft pixels, or an opaque background.

## Version 1 manifest and provenance contracts

[`../../plane-art.js`](../../plane-art.js) is the pure, DOM-free Phase 1 runtime
resolver. `planeFamily(icaoType, aircraftClass)` classifies only normalized
ICAO values from an authored table, `planeArtwork(aircraft)` applies the approved
brand/partnership/special/generic precedence, and `planeAsset(artworkId,
direction)` returns an independent reviewed manifest record. Unknown or hostile
values fall back to authored generic records; they are never interpolated into
asset paths. Callers pass `planePose(...).facing` as the direction. Legacy SVGs
remain an image-load error fallback and are not normal resolver results.

[`../../assets/planes/v1/manifest.js`](../../assets/planes/v1/manifest.js) is the
canonical public contract. It exports controlled values for direction, category,
visual size class, and approval status, followed by one record per directional
asset. A record's stable key is `<artwork-id>:<direction>`; it does not change
when an image is regenerated. Left and right are independent records and files,
never browser-mirrored variants.

The following fields are hand-authored: `key`, `artworkId`, `direction`,
`category`, `url`, `sizeClass`, ICAO mappings, allowed callsign prefixes,
`fallbackId`, and `promptRecordKey`. URLs are reviewed string constants. Runtime
code may normalize an API value and use it in a table lookup, but must never put
a callsign, ICAO type, airline name, or other API string into a file path.

The processing pipeline supplies `width` and `height` from the normalized output
and the generation workflow supplies `generationModel`. A reviewer sets
`approvalStatus`; generation and processing never promote a candidate to
`approved`. PG-002 records use `planned` because their production WebPs have not
yet been generated.

[`prompts.json`](prompts.json) is development-only provenance. Every manifest
record links to exactly one prompt record, and each prompt record links back by
manifest key and authored output URL. Provider, non-secret project ID, pinned
model ID, complete prompt, references, generation timestamp, candidate notes,
approval notes, and output SHA-256 are recorded there. `generatedAt` and
`sha256` remain `null` only while an asset is planned; generation fills the UTC
timestamp and processing fills the hash before approval.

Validation enforces controlled values, stable-key uniqueness, exactly one record
per artwork/direction pair, 960 × 330 intrinsic dimensions, matching authored
v1 URLs, reciprocal prompt/output links, and complete provenance fields. It also
walks same-direction fallbacks: each chain must be cycle-free and end at a
generic artwork record or `legacy-svg-jet` / `legacy-svg-prop`. The legacy IDs
refer to the existing inline SVG load-error fallback and are deliberately not
asset URLs.

## PG-003 prompt catalog and shape-guide gate

[`prompts.json`](prompts.json) now contains all 74 approved treatments in both
directions (148 prompt records). Each record copies its canonical treatment
name and aircraft shape from the approved matrix, then adds explicit category,
engine, propeller, rotor, landing-gear, paint/branding, crop, background, and
identity constraints. A left-facing record names its right-facing result as a
style/livery reference while requiring a new independent image; mirroring is
always prohibited.

[`shape-guides/inventory.json`](shape-guides/inventory.json) inventories the 54
distinct aircraft-family descriptions currently used by the matrix. No shape
guide is silently inferred from a proof or a similar aircraft: every current
entry is truthfully marked `missing`, carries provenance/ownership/permission
notes, and has a concrete blocked task. Consequently all 148 prompt records are
`blocked-missing-shape-guide` until their exact original guide is created and
reviewed. Unlicensed third-party model or reference inputs are prohibited.

Run `npm run plane-art:prompts` after an approved matrix change to rebuild the
deterministic catalog and inventory. Run `npm run plane-art:validate-prompts`
before generation or committing changes. The validator rejects unknown or
missing IDs, missing fields, duplicate prompt keys, bad left/right links,
unknown guide/reference IDs, incomplete provenance, and missing files for any
reference or guide that claims to exist.

## Selective Vertex generation (PG-004)

[`../../scripts/generate-plane-library.ps1`](../../scripts/generate-plane-library.ps1)
supersedes the fixed four-image `generate-vertex-plane-proofs.ps1` workflow for
library production. The proof script remains usable only for reproducing the
committed design proofs; it is not the production batch tool.

Generation is always explicitly scoped. Pass one or more `-ArtworkId` values
and `-Direction right`, `left`, or `both`. A full catalog selection requires the
two deliberate switches `-All -ConfirmAll`. Inspect the offline plan first:

```powershell
npm run plane-art:generate -- -ArtworkId aal-narrowbody -Direction right -DryRun
```

The dry run validates prompts, available guide files, references, safe output
paths, and approved-output conflicts, then prints every input hash, raw output,
approved target, prompt revision, model, and estimated Vertex request count. It
does not authenticate or call Vertex. Current catalog entries intentionally
fail this gate until PG-003's missing shape-guide tasks are completed.

After the Phase 1 visual gate, the generator also appends every authored
`generationAmendments` entry in `prompts.json` to the immutable source prompt.
The current effective future revision is `v1+pg011-lighting-1`; its clean-even-
daylight rule is included in the request key, printed revision, sent prompt, and
request metadata without rewriting the v1 text that records how Phase 1 was
originally generated.

For a paid run, either pass an arbitrary service-account JSON location with
`-CredentialPath` or omit it to use configured Application Default Credentials.
No credential filename is assumed. `-ProjectId`, `-Location`, `-Model`, and
`-CandidateCount` select the recorded request settings; defaults use the pinned
catalog model and global location. Authentication output, authorization headers,
tokens, private keys, and credential JSON are suppressed or redacted.

Raw candidates and their request metadata are written only below
`.generated/plane-art/candidates/`. The gitignored ledger at
`.generated/plane-art/ledger.json` checkpoints each completed request by a
deterministic hash of its prompt, model, project, location, candidate count, and
reference hashes. Repeating a completed selection skips it; `-Force` is required
to retry it. The generator never writes an approved production WebP and refuses
to run when the directional approved target already exists.

Left artwork additionally requires the corresponding right prompt record to be
marked `approved`, to contain its production SHA-256, and to match the right
WebP beneath `assets/planes/v1/`. That approved right image is sent as a style
and livery input while the left prompt continues to require an independent,
unmirrored result.

## Deterministic production processing (PG-005)

[`../../scripts/process-plane-art.mjs`](../../scripts/process-plane-art.mjs)
implements the approved edge-connected white-matte cleanup and normalization
contract. It accepts exactly one authored manifest ID and one direction per run;
it never flips or mirrors an image. When the input came from the production
generator, pass that request's `metadata.json` so the processor verifies the
candidate hash, artwork ID, and direction before writing anything:

```powershell
npm run plane-art:process -- `
  --artwork-id aal-narrowbody `
  --direction right `
  --input .generated/plane-art/candidates/aal-narrowbody/right/<request-key>/candidate-1.png `
  --source-metadata .generated/plane-art/candidates/aal-narrowbody/right/<request-key>/metadata.json `
  --proof .generated/plane-art/proofs/aal-narrowbody-right.png
```

The only production destination is
`assets/planes/v1/<artwork-id>-<direction>.webp`. Before it writes, the tool
checks WebP type, 960 × 330 dimensions, alpha, transparent corners, padding,
clipping, y=290 baseline, possible white-matte fringe, and the 40,000–110,000
byte range/ceiling. The optional proof sheet shows the result at the actual
272 px hero and 46 px blip sizes over both `Oats.jpg` and checkerboard.

If automatic cleanup cannot separate the aircraft without damage, repair the
alpha manually and supply the repaired RGBA file with `--manual-repair`; the
original `--input` remains the linked source. Do not tune thresholds per image.
An out-of-range file requires `--byte-exception-note` containing the dated,
approved visual justification required above.

Each successful run prints stable JSON and writes the same report beneath
`.generated/plane-art/processed/` by default. It includes source/repair/output
SHA-256 hashes, source request linkage, dimensions, bytes, all checks, exact
settings, content bounds, and the Sharp/libvips versions that define the
documented deterministic equivalent. Identical inputs and recorded versions
produce identical WebP bytes and report data.

An existing production file is never overwritten by default. The explicit
replacement workflow requires both `--replace-approved` and a non-empty
`--replacement-note`; the report then records the previous hash and reason.
Processing never changes `approvalStatus`: a reviewer still updates manifest
and prompt metadata and approves both the sky/checkerboard proof and directional
pair after processing.

## Automated library validation (PG-006)

Run `npm run plane-art:validate` locally and in CI before publishing plane-art
changes. The command reports every detected problem in one run. It validates
stable IDs and authored URLs, reciprocal prompt links, mapping uniqueness and
category compatibility, terminating fallbacks, and hostile-input containment.
It also scans public modules and assets for credential material and Vertex
runtime/SDK references.

Planned records may point to files that have not been generated yet. Once a
manifest direction or prompt record is marked `approved`, validation requires
an approved left/right pair, both production WebPs, the 960 × 330 canvas and
alpha channel, the byte ceiling, and a SHA-256 that matches approved prompt
metadata. Approval therefore cannot get ahead of either its counterpart,
provenance, or committed image.

## Development review gallery (PG-007)

Run `npm run dev`, then open
[`../plane-gallery.html`](../plane-gallery.html) at
`http://localhost:8080/design/plane-gallery.html`. The page is deliberately not
linked from the public homepage. It imports the production v1 manifest, reads
the development prompt catalog, and probes the authored production asset URLs;
there is no copied gallery inventory to keep synchronized.

Each manifest treatment appears as an adjacent right/left pair at the production
272 px hero and 46 px blip sizes, across climb/level/descent tilts on both the
production sky and a checkerboard alpha background. Missing planned files are
shown as failures rather than silently replaced. Category filters, provenance
and mapping metadata, the Plan 2 reject checklist, and browser-local approval
notes support manual review. Export notes to JSON before clearing browser data
or transferring the decision into `prompts.json`; the gallery cannot approve or
publish artwork itself.

## Phase 1 mainline passenger pairs (PG-008)

The first seven branded mainline treatments are approved in both independently
generated directions: `aal-narrowbody`, `aal-widebody`, `ual-narrowbody`,
`ual-widebody`, `dal-narrowbody`, `dal-widebody`, and `swa-narrowbody`. Their 14
production WebPs live beneath `assets/planes/v1/`; the public manifest and the
matching records in `prompts.json` are the approval and provenance sources of
truth.

Four original, project-owned technical silhouettes in `shape-guides/` unblocked
this batch. Each committed PNG has an editable SVG source in `shape-guides/src/`,
and `shape-guides/inventory.json` records ownership, permission, source, and
availability. No third-party aircraft reference was introduced.

Every final master was independently generated by the pinned
`gemini-3.1-flash-image` Vertex workflow. The initial
`dal-widebody:left` candidate was rejected because its tail livery did not match
the approved right-side family; it was never promoted to production, and the
authorized forced regeneration is the recorded final candidate. The processor's
manual-repair path was required for `dal-narrowbody:right` and
`aal-narrowbody:left` after an off-white matte made their automatic results
undersized. Those repairs changed background transparency only and are named in
the prompt provenance notes.

Five visually approved outputs fall below the 40 KB target while retaining the
frozen quality-90 settings: `aal-widebody:right`, `swa-narrowbody:right`,
`dal-narrowbody:right`, `aal-widebody:left`, and `swa-narrowbody:left`. Each has
a dated byte-range exception in its approval notes. All 14 remain below the
110 KB ceiling and pass the format, 960 × 330 canvas, alpha, transparent-corner,
padding, baseline, clipping, and fringe checks. Pair approval was performed at
272 px hero and 46 px blip sizes over the production sky and checkerboard.

## Phase 1 cargo, regional, and generic pairs (PG-009)

The Phase 1 `fdx-widebody`, `ups-widebody`, `american-eagle-regional`,
`generic-regional`, `generic-narrowbody`, and `generic-widebody` treatments are
approved in both independently generated directions. Their twelve production
WebPs live beneath `assets/planes/v1/`; the public manifest and matching
`prompts.json` records contain stable mappings, generation timestamps, source
request keys, output hashes, approval notes, and any processing exceptions.

Six original project-owned guides were added for the exact cargo, regional,
narrowbody, and widebody families required by this batch. Their rendered PNGs,
editable SVG sources, ownership, permission, and provenance are recorded under
`shape-guides/`. No third-party aircraft reference was introduced.

All twelve aircraft masters were independently generated with the pinned
`gemini-3.1-flash-image` Google Cloud Vertex AI workflow. Regional Vertex
locations were used when global dynamic capacity returned `RESOURCE_EXHAUSTED`;
each request records its actual location. Two rejected generic-widebody left
candidates were never promoted: one copied guide captions and faced the wrong
direction, and one resembled a recognizable airline tail treatment.

The FedEx right and both generic-regional outputs used the documented manual
alpha-only repair path; their aircraft masters remain the linked Vertex
candidates. Those three files also have dated below-range exceptions with the
frozen quality-90 settings unchanged. The other nine outputs passed the normal
edge-connected white-matte workflow and byte-range gate.

Cargo review confirmed readable, correctly oriented FedEx and UPS branding.
The three generic pairs contain no airline name, logo, registration, or
recognizable brand mark. American Eagle selection is restricted to confident
`ENY` and `JIA` callsigns; uncertain regional operators fall back to the
production-ready `generic-regional` pair. Pair review covered direction,
anatomy, crop, baseline, alpha edges, and recognition at 272 px hero and 46 px
blip sizes over both the production sky and checkerboard.

## Phase 1 business, light-aircraft, and agricultural pairs (PG-010)

The Phase 1 `generic-bizjet-small`, `cessna-high-wing`, and
`air-tractor-yellow` treatments are approved in both independently generated
directions. Their six production WebPs live beneath `assets/planes/v1/`; the
manifest and matching `prompts.json` records contain the approval state,
generation timestamps, source request keys, output hashes, and review notes.

Three original project-owned guides were added for the Citation/Phenom-class
jet, C150/C172/C182/C206 high-wing family, and Air Tractor family. Their PNGs,
editable SVG sources, ownership, permission, and provenance are recorded under
`shape-guides/`. The neutral/private-aircraft prompt contract explicitly
forbids copied organizations, logos, recognizable brand marks, and real private
registrations; omission of a registration is preferred.

All six final aircraft masters were independently generated with the pinned
`gemini-3.1-flash-image` Vertex workflow. Rejected candidates that copied the
airline style proof, a registration, or technical-guide captions were not
promoted. Unbranded business, general-aviation, agricultural, helicopter, and
military requests now omit the airline style proof while approved records keep
their original reference lists for accurate provenance.

The two neutral business-jet outputs required the documented manual alpha-only
repair path and dated below-range exceptions; their aircraft masters remain the
linked Vertex candidates. The Cessna and Air Tractor pairs passed the standard
edge-connected white-matte workflow. Pair review covered direction, silhouette,
engine and propeller count, fixed/retracted gear, agricultural hardware,
relative scale, crop, baseline, alpha edges, and recognition at 272 px hero and
46 px blip sizes over both production sky and checkerboard backgrounds.

## Phase 1 complete-batch freeze (PG-011)

The complete 16-pair gate passed after ten reviewer-rejected dark-upper-surface
directions received the constrained lighting correction recorded in their
prompt provenance. The full batch was screened against the amended clean-even-
daylight rule; the other 22 directions already passed and were not changed. Run
`npm run plane-art:audit-phase1` for the reproducible dimensions, byte
distribution, alpha bounds, padding, baseline, prompt-revision, and model
report. [`phase1-production-freeze.md`](phase1-production-freeze.md) is the
frozen decision record that Phase 2 must follow; its ten below-target files have
explicit approval notes, no file exceeds the byte ceiling, and all 32 assets
pass the library validator.

## Phase 1 release runbook (PG-016)

The production workflow is deliberately split from the public runtime. Only
the approved WebPs, the authored manifest, and browser modules are published;
generation credentials, Vertex availability, billing, and Google SDKs are not
runtime dependencies.

Use this sequence for a new candidate or an approved replacement:

1. **Generate.** Validate the prompt catalog, run a scoped dry run, and then
   use `npm run plane-art:generate -- -ArtworkId <id> -Direction <direction>`.
   Generation writes candidates and request metadata only below the gitignored
   `.generated/plane-art/candidates/` tree. It never publishes an image.
2. **Review candidates.** Reject incorrect direction, anatomy, branding,
   identity details, lighting, crop, or style before processing. For a left
   view, compare it with the approved right view while still requiring an
   independently generated image. Record the chosen candidate and rejected
   alternatives in its provenance notes.
3. **Process.** Run `npm run plane-art:process` with the artwork ID, direction,
   chosen input, and its `metadata.json`. Inspect the generated production-sky
   and checkerboard proof at both hero and blip sizes. Use the documented
   manual alpha-repair or byte-exception options only when their required
   dated notes and review exist.
4. **Approve.** After pair review, update both manifest directions and their
   reciprocal `prompts.json` records together. Set approval status, generation
   time, candidate/approval notes, and the exact production SHA-256. Approval
   is a human decision; generation and processing never set it.
5. **Replace.** Never overwrite an approved file implicitly. Re-run processing
   with `--replace-approved --replacement-note "<dated reason>"`, review the
   new proof and pair, update the recorded hash and notes, then revalidate. A
   different library contract belongs in a new versioned directory instead of
   silently changing stable URLs.
6. **Validate and release.** Run `npm run plane-art:validate`, `npm test`, and
   `npm run test:browser`. Confirm the change contains only reviewed public
   outputs and metadata; no credential, raw candidate, or generation runtime
   belongs in the public tree.
7. **Archive.** The approved committed WebP plus prompt, request/reference
   hashes, processing settings, approval notes, and output hash is the durable
   master. Raw candidates and working PNGs remain under `.generated/` and may
   be discarded after the approved WebP and metadata are committed. There is
   no external raw-master archive for Phase 1.

The released inventory and the behavior that a browser with an empty cache
must preserve are frozen in
[`phase1-release-baseline.md`](phase1-release-baseline.md). PG-017 may add
throttled performance measurements, but must compare them with this baseline
rather than changing the Phase 1 release definition.

### Adding a future asset-library version

A future library is added beside this one, for example
`assets/planes/v2/manifest.js` and `/assets/planes/v2/*.webp`. Do not replace v1
files in place or reuse their URLs for different bytes. The application imports
one explicit manifest version per deployment; already open pages can continue
using cached v1 URLs while newly deployed pages select v2. Keep v1 published
until its cache lifetime and any supported rollback window have passed. Prompt
keys and output links include their version so v1 and v2 provenance can coexist.
