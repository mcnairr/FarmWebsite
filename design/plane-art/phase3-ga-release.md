# PG-023 Phase 3 GA and turboprop release

Issue PG-023 adds six treatments and twelve independently generated directional
WebPs: `cirrus-low-wing`, `beech-piston`, `pilatus-pc12`, `daher-tbm`, `atr`,
and `generic-twin-piston`.

All source candidates were generated with Google Cloud Vertex AI using the
pinned `gemini-3.1-flash-image` model. Right-facing candidates were reviewed and
approved before their production WebPs were supplied to Vertex as style-only
references for new, independently generated left-facing candidates. No image
was mirrored or flipped.

The six project-owned shape guides are reproducible with
`node scripts/build-phase3-ga-shape-guides.mjs`. Candidate processing uses the
frozen edge-connected white-matte recipe, 960 x 330 canvas, y=290 baseline,
quality-90 WebP encoding, and the 40,000-110,000 byte production gate.

The first Cirrus and PC-12 candidates were rejected because their cabins and
aircraft anatomy were malformed. Their narrowly scoped retry instructions are
recorded in `prompts.json`. The first ATR candidate was rejected because it
contained an identifiable registration. Only the accepted retries are present
in the production library.

Manual gallery review covered the production sky and checkerboard at 272 px
hero and 46 px blip sizes. Both directions pass aircraft-family silhouette,
engine and propeller count, landing gear, crop, baseline, alpha-edge, scale,
pair-consistency, and generic/private-identity constraints.

Run `npm run plane-art:audit-phase3-ga` for the reproducible six-pair audit and
`npm test` for the release gate.
