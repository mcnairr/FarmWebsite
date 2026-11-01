# PG-022 Phase 3 airliner release

Issue #22 adds 18 exact airline/aircraft treatments and 36 independently
generated directional WebPs to the v1 plane-art library:

- `baw-widebody`, `dlh-widebody`, `afr-widebody`, and `klm-widebody`
- `fdx-trijet`, `ups-trijet`, `gti-widebody`, and `dhl-widebody`
- `dal-b717`, `dal-b757`, `ual-b787`, and `aal-b777`
- `dlh-b747`, `baw-a380`, `jbu-a220`, and `jbu-e190`
- `united-express-crj200` and `delta-connection-crj900`

## Production process

All 36 source images were generated with Google Cloud Vertex AI using the
catalog-pinned `gemini-3.1-flash-image` model. Each treatment uses an original,
editable shape guide. The left and right views are separate generations; no
production image is mirrored or flipped.

The batch uses the scoped `pg022-chroma-magenta-1` generation exception.
Vertex renders against uniform `#FF00FF`, then
`extract-plane-chroma.mjs --color magenta --scope global` removes the matte.
The repaired PNG is passed to the frozen 960 x 330, quality-90 WebP processor.
Every approved record stores the Vertex request, prompt revision, reference
hashes, extracted-alpha hash, output hash, and dated visual approval notes.

The Air France left request repeatedly produced a Google HTTP 417 when the
approved right WebP was transmitted. Its recorded
`pg022-afr-left-vertex-retry-1` exception retains and verifies the sibling
reference hash but omits that image payload from the Vertex request. The
production style proof and original family guide remain image inputs. This
exception is explicit in prompt provenance and does not permit mirroring.

## Review and release gate

Review covered aircraft family, distinctive engine count and placement,
direction, readable livery and wordmarks, crop, baseline, production-sky and
checkerboard alpha edges, and 272 px hero and 46 px blip sizes. Rejected
candidates included copied shape-guide layouts and an incorrect four-engine
Atlas render; only corrected independent generations were approved.

The released batch contains exactly 36 WebPs totaling 1,639,256 bytes. File
sizes range from 17,118 to 109,222 bytes, with a 42,393-byte median. Outputs
below the advisory 40 KB target retain a reviewed byte-range exception; no
output exceeds the 110 KB ceiling.

Exact branded type mappings run before broad branded-family mappings. This
preserves the requested A380, 747, 787, 777, 757, 717, A220, E190, MD-11,
CRJ-200, and CRJ-900 variants while retaining the existing general fallbacks.

Run the release checks from the repository root:

```text
npm run plane-art:validate-prompts
npm run plane-art:validate
node scripts/audit-phase3-airliners.mjs
npm test
npm run test:browser
```
