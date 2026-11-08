# Phase 4 observed-traffic decision (PG-027)

The initial evidence-only review on **2026-11-08** selected zero additions. A
follow-up product decision approved the two strongest uncovered silhouettes for
an intentionally small, exploratory Phase 4 expansion: `cirrus-vision-jet` and
`citation-x`. Version 1 now contains 76 treatments and 152 independently
generated directional masters, still below the 160-master ceiling.

## Observation set and privacy method

The retained Cloudflare Workers Observability sample covers
`2026-10-30T12:29:17.084Z` through `2026-11-07T18:52:56.986Z`. It contains
5,829 `aircraft_observed` events representing 374 distinct public ADS-B
aircraft. Repeated polling was deduplicated by aircraft key before ranking.
The report retains only aggregate counts, three-letter callsign prefixes, ICAO
types, broad aircraft classes, public airline/equipment labels, and the
existing artwork decision. It does not retain aircraft identifiers,
registrations, or complete callsigns.

Run `npm run plane-art:audit-phase4-traffic` against the ignored `worker-logs/`
directory to reproduce the aggregate. The audit identified 70 candidate groups
covering 148 distinct aircraft: 71 aircraft used a generic artwork, 84 had an
ICAO type absent from the manifest allowlists, and 15 had no ICAO type. Those
figures overlap when one aircraft meets more than one condition.

The downloader state reached `2026-11-08T17:03:06.692Z`; the last aircraft in
that retained interval was observed at the end of the period above. A final
incremental refresh was attempted on 2026-11-08 but Cloudflare rejected the
Wrangler OAuth credential with 403, so the decision is explicitly bounded by
the retained interval rather than presented as a live all-time census.

## Ranking and decisions

Candidates were judged by distinct-aircraft count first (poll counts are shown
only as supporting evidence), then visual distinctiveness, mapping confidence,
and whether the current image is misleading. A brand was not approved when the
operator prefix does not reliably identify the livery visible on the airframe.

| Rank | Candidate or cohort | Distinct aircraft / observations | Existing fallback | Decision and rationale |
| ---: | --- | ---: | --- | --- |
| 1 | Airbus aliases `A21N`, `A20N`, `BCS1`, `BCS3` | 62 / 993 | Existing branded or generic narrowbody | Reject. These are familiar A320/A321neo and A220-family shapes already represented honestly by the narrowbody treatments; a second treatment would add little visible value. The lone Breeze record is not enough to justify a brand pair. |
| 2 | SkyWest `E75L`, `CRJ7`, `CRJ2`, `CRJ9`, `E170` | 20 / 232 | `generic-regional` | Reject. Frequency is high, but `SKW` identifies the operator, not a dependable marketed carrier or livery. The neutral regional family is silhouette-correct and safer than showing United, Delta, American, or Alaska branding incorrectly. |
| 3 | Citation X (`C750`) | 3 / 75 | `generic-bizjet-small` | **Add.** This was the most frequently observed confidently mapped uncovered business-jet type. Its long swept fuselage, rear engines, and T-tail are visibly different from the compact generic fallback. |
| 4 | Citation Latitude (`C68A`, NetJets) | 2 / 19 | `generic-bizjet-small` | Reject. The existing NetJets treatment is based on a different large-business-jet silhouette; reusing it would trade a neutral size approximation for incorrect geometry. Two aircraft do not justify a new treatment. |
| 5 | Cirrus Vision Jet (`SF50`) | 2 / 13 | `cessna-high-wing` | **Add.** This was the clearest misleading fallback: a single-engine V-tail jet was shown as a high-wing piston airplane. Its silhouette is unique and the ICAO mapping is exact. |
| 6 | One-off missing airline/cargo brands (including `KAL`, `ABX`, `ROU`, `POE`, `CAL`, `ANA`, and `MXY`) | 1 per operator/type group | Matching generic widebody, narrowbody, or regional family | Reject. Mapping confidence varies and no brand/type group recurred across distinct aircraft. The current neutral families communicate the silhouette without inventing brand certainty. |
| 7 | One-off mismatched silhouettes (`M20T`, `SB20`, `D328`) | 1 each / 23 combined | Cessna high-wing or generic small bizjet | Reject pending recurrence. The fallback is imperfect, but each type appeared on only one aircraft and none supports a paid two-direction treatment from this sample alone. |
| 8 | Remaining generic business jets and missing/unstable types | 1-2 per group | Generic small/large bizjet or class fallback | Reject. Existing neutral art matches the useful on-screen category; unknown types and anomalous values such as `ST75`, `AS50`, and `GA7C` are not reliable generation or mapping inputs. |

Every row emitted by the audit falls into one of the cohorts above: an existing
silhouette-correct treatment, an ambiguous operator, a non-recurring missing
brand, a low-frequency distinct silhouette, or unreliable metadata. The two
approved additions are exact-type, neutral treatments; all brand candidates and
all remaining silhouettes stay rejected.

## Generation, rejection, and approval record

Both treatments use original project-owned SVG/PNG shape guides and neutral
private-aircraft paint with no organization, logo, or real registration. The
pinned Google Cloud Vertex AI model is `gemini-3.1-flash-image`. Each final
direction is an independent generation; the approved right WebP was supplied
to the left request only as a style/lighting reference and was never mirrored.

The first right-side requests were rejected and retained below `.generated/`:

- Vision Jet request `6d8bf811685847d5b483` pointed left and lacked credible
  cockpit anatomy.
- Citation X request `62f95d67aa6bdf614617` produced four engines and
  duplicated wing/tail surfaces.

Scoped retry `pg027-anatomy-retry-1` made direction, cockpit, exact engine
count/placement, one wing pair, and one family-accurate tail hard gates. The
approved requests are:

| Treatment | Right request | Left request | Final bytes (R / L) |
| --- | --- | --- | ---: |
| Vision Jet | `a02e0c768d1244acb2a6` | `fb50fa9894ba9c9d44ca` | 34,588 / 30,556 |
| Citation X | `1adcc598b3889b7e195a` | `bfe681a4d90fcce1f61f` | 26,822 / 26,112 |

All requests used scoped magenta exception `pg027-chroma-magenta-1`. Global
magenta extraction at distance 120 preceded the frozen 960 x 330, quality-90,
alpha-quality-100 processor. All four images pass format, dimensions, alpha,
transparent-corner, padding, baseline, clipping, white-fringe, and 110 KB
ceiling checks. Their visually simple neutral paint compresses below the 40 KB
target; each processing report carries the dated review exception. Production
sky and checkerboard proofs were reviewed at 272 px hero and 46 px blip sizes.

## Release and performance gates

The manifest remains `assets/planes/v1/manifest.js`; no existing v1 bytes or
URLs were replaced, and the four new URLs are additive, so no v2 is needed.
The approved-master count is 152, below the 160 ceiling. `SF50` resolves exactly
to `cirrus-vision-jet`; `C750` resolves exactly to `citation-x`. Runtime loading
is unchanged: the resolver returns one authored
URL for a visible aircraft, duplicate URLs share a request, and unused library
files are not requested. A fresh 2026-11-08 run used the PG-026 mobile profile
(844 x 390 @2x, 4x CPU slowdown, 150 ms latency, 1.6 Mbps down, 750 Kbps up):

| Visible aircraft | Asset mix | Cold requests | Cold bytes | Cold ready | Warm bytes | Warm ready |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | unique | 1 | 33,608 | 2.810 s | 0 | 1.390 s |
| 4 | unique | 4 | 137,612 | 3.634 s | 0 | 1.427 s |
| 4 | duplicate | 1 | 28,412 | 2.762 s | 0 | 1.424 s |
| 8 | unique | 8 | 258,306 | 4.518 s | 0 | 1.475 s |
| 8 | duplicate | 1 | 28,412 | 2.790 s | 0 | 1.456 s |

Cold requests still equal visible unique URLs, warm transfers remain zero, and
the maximum measured CLS was 0.0867. The additive treatments are requested only
when visible, so they add no unconditional initial-download cost and preserve
demand-driven loading.

Verification commands:

```text
npm run plane-art:audit-phase4-traffic
npm run plane-art:audit-phase4
npm run plane-art:validate-prompts
npm run plane-art:validate
npm test
npm run test:browser
npm run plane-art:measure-performance
```
