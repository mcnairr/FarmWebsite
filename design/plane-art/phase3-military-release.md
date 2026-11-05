# PG-025 Phase 3 military release

Issue #25 adds six independently generated directional WebPs for
`c130-military`, `c17-military`, and `kc135-military`.

All source candidates were generated with Google Cloud Vertex AI using the
pinned `gemini-3.1-flash-image` model. The three project-owned shape guides are
reproducible with `npm run plane-art:build-phase3-military-guides`. Left views
are new generations that use the approved right WebP as a style reference; no
production image is mirrored or flipped.

The batch uses the scoped `pg025-chroma-magenta-1` exception. Vertex renders on
uniform `#FF00FF`, deterministic global chroma extraction runs at distance 120,
and the frozen processor produces 960 x 330 quality-90 WebPs. All six neutral-
gray outputs are below the advisory 40 KB target and carry dated, reviewed byte-
range exceptions; every file remains below the mandatory 110 KB ceiling.

Gallery review covered the production sky and checkerboard at 272 px hero and
46 px blip sizes. Both directions pass aircraft-family silhouette, four-engine
or four-propeller arrangement as applicable, C-130/C-17 cargo identity, KC-135
tanker boom, retracted gear, crop, baseline, transparent edges, relative scale,
and neutral U.S. military-gray treatment without a unit, base, serial, insignia,
or false official affiliation.

Run `npm run plane-art:audit-phase3-military` for the reproducible three-pair
audit and `npm test` for the release gate.
