# Phase 3 release gate (PG-026)

Approved **2026-11-05**. Version 1 contains exactly **74 treatments and 148
approved independently generated directional WebPs**. The manifest and prompt
catalog cover every treatment with controlled categories, size classes, ICAO
types, callsign prefixes, and cycle-free same-direction fallbacks.

## Final gallery review and repairs

All 74 pairs were compared over the production sky and checkerboard at 272 px
hero and 46 px blip sizes, in both directions and at climb, level, and descent
tilts. The final review rejected twelve files identified by the reviewer:

- `fdx-widebody:left` and `ual-widebody:left`: enclosed magenta was removed with
  the documented global chroma extraction at distance 120.
- Both directions of `atr`, `generic-twin-piston`, and `pilatus-pc12`, plus
  `beech-piston:left`: smoke-like upper shading was corrected with the frozen
  deterministic lighting repair while preserving alpha and geometry.
- `dash8:right` and `generic-narrowbody:left`: new Vertex candidates corrected
  malformed wing geometry and the wrong direction respectively.
- `beech-piston:right`: the new Vertex candidate was rejected for drone-like
  geometry. A constrained OpenAI precise-object edit restored conventional
  Baron-class twin-piston anatomy, removed its registration, and preserved the
  approved neutral treatment. The output provenance retains the Vertex request,
  prompt revision, edit hash, replacement reason, and final SHA-256.

Every replacement was processed at 960 x 330, quality 90, alpha quality 100,
effort 4, and the fixed y=289 visible-pixel baseline. Sub-40 KB replacements
retain explicit quality-reviewed exceptions; no output exceeds 110 KB.

## Local and demo traffic audit

The representative eight-flight demo resolves American, United, Southwest,
Delta, Frontier, FedEx, Cessna 172, and a SkyWest-operated E175-class regional
aircraft without an unsafe or missing path. `SKW` intentionally stays on the
generic regional treatment because the operating brand is ambiguous without a
reliable marketed-carrier signal. That is the only obvious demo gap and is a
Phase 4 observation, not justification for an ad-hoc treatment. No live traffic
capture was added to the repository; future additions remain limited to the
evidence rules in PG-027.

## Cold-cache mobile evidence

The 2026-11-05 throttled run used an 844 x 390 @2x mobile viewport, 4x CPU
slowdown, 150 ms latency, 1.6 Mbps download, and 750 Kbps upload.

| Visible aircraft | Asset mix | Cold requests | Cold bytes | Cold ready | Warm bytes | Warm ready |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | unique | 1 | 33,608 | 3.045 s | 0 | 1.398 s |
| 4 | unique | 4 | 137,612 | 3.483 s | 0 | 1.363 s |
| 4 | duplicate | 1 | 28,412 | 2.736 s | 0 | 1.377 s |
| 8 | unique | 8 | 258,306 | 4.210 s | 0 | 1.454 s |
| 8 | duplicate | 1 | 28,412 | 2.814 s | 0 | 1.393 s |

Cold requests equal visible unique URLs, duplicate aircraft share one request,
unused library files are never requested, and every warm run transfers zero
image bytes. Measured CLS was 0.0435 in each scenario.

## Model, prompt, limitations, and replacement

Production generation remains pinned to Google Cloud Vertex AI model
`gemini-3.1-flash-image`. The final geometry retries add scoped prompt revision
`pg026-visual-rejection-retry-1`; the earlier global clean-lighting amendment
and per-batch chroma exceptions remain intact. Known limitations are generated
micro-detail at enlarged sizes, intentionally generic ambiguous operators, and
recorded below-target byte exceptions for visually simple aircraft.

Approved replacement generation requires both `-ReplaceApproved` and a nonempty
`-ReplacementNote`. It writes candidates only below `.generated/plane-art/` and
keeps the approved target read-only. Promotion still requires processing with
`--replace-approved --replacement-note`, visual pair review, provenance/hash
updates, and the full validation suite.

## Release commands

```text
npm run plane-art:validate-prompts
npm run plane-art:validate
npm test
npm run test:browser
npm run plane-art:measure-performance
```
