# Phase 2 release gate (PG-021)

Approved **2026-11-01**. Phase 2 contains exactly **40 approved treatments and
80 independently generated directional WebPs**. `npm run plane-art:audit-phase2`
is the reproducible gate report; `npm run plane-art:validate` verifies metadata,
prompt, hash, image, mapping, fallback, and public-safety parity.

## Forty-pair gallery review

All Phase 1 pairs and the 24 Phase 2 additions were compared together in the
development gallery at 272 px hero and 46 px blip sizes, in both directions,
over the production sky and checkerboard. Review covered camera angle, daylight,
scale class, padding, 289 px baseline, transparent edges, anatomy, branding or
neutral treatment, and left/right consistency. The approved set is:

- Phase 1: `aal-narrowbody`, `aal-widebody`, `ual-narrowbody`, `ual-widebody`,
  `dal-narrowbody`, `dal-widebody`, `swa-narrowbody`, `fdx-widebody`,
  `ups-widebody`, `american-eagle-regional`, `generic-regional`,
  `generic-narrowbody`, `generic-widebody`, `generic-bizjet-small`,
  `cessna-high-wing`, and `air-tractor-yellow`.
- Phase 2 airline and regional: `asa-narrowbody`, `jbu-narrowbody`,
  `fft-narrowbody`, `nks-narrowbody`, `aay-narrowbody`, `scx-narrowbody`,
  `hal-narrowbody`, `hal-widebody`, `aca-narrowbody`, `aca-widebody`,
  `wja-narrowbody`, `amx-narrowbody`, `voi-narrowbody`,
  `delta-connection-regional`, `united-express-regional`, and
  `alaska-regional`.
- Phase 2 business, GA, turboprop, and agricultural: `netjets-bizjet`,
  `flexjet-bizjet`, `generic-bizjet-large`, `cessna-caravan`,
  `piper-low-wing`, `king-air`, `dash8`, and `air-tractor-red-white`.

No additional visual outlier remained after the pair-level repairs and approval
work recorded by PG-018 through PG-020. The final audit reports 80 WebPs at
960 × 330, all with alpha and transparent corners. File sizes range from 15,604
to 90,658 bytes (median 31,668; total 3,058,620 bytes). Below-target files are
recorded quality-approved exceptions; none exceeds the 110 KB ceiling.

## Mapping and safety decision

The resolver now includes Phase 2 business-jet, Caravan, Piper, King Air,
Dash 8, and split Air Tractor families in addition to the airline and regional
tables. `EJA` and `LXJ` branding is allowed only for compatible reviewed
business-jet types. Ambiguous regional operators remain generic, incompatible
families cannot inherit a brand, and invalid or hostile strings can select only
authored fallback records. Table-driven tests cover positive, incompatible,
ambiguous-regional, unknown, and hostile cases.

## Performance smoke check

The throttled mobile harness was rerun on **2026-11-01** with the frozen
844 × 390 @2x viewport, 4× CPU slowdown, 150 ms latency, 1.6 Mbps download,
and 750 Kbps upload profile.

| Visible aircraft | Asset mix | Cold requests | Cold bytes | Cold ready | Warm bytes | Warm ready |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | unique | 1 | 33,608 | 2.744 s | 0 | 1.373 s |
| 4 | unique | 4 | 137,612 | 3.315 s | 0 | 1.396 s |
| 4 | duplicate | 1 | 28,412 | 2.755 s | 0 | 1.355 s |
| 8 | unique | 8 | 255,034 | 4.119 s | 0 | 1.432 s |
| 8 | duplicate | 1 | 28,412 | 2.692 s | 0 | 1.356 s |

Library growth did not change demand-driven loading: cold requests equal the
visible unique artwork URLs, duplicates share one URL, unused treatments are
not downloaded, and every warm run transferred zero image bytes. The browser
suite also confirms visible-only requests, cache reuse, and stable layout.

## Release commands

```text
npm run plane-art:audit-phase2
npm run plane-art:validate
npm test
npm run test:browser
npm run plane-art:measure-performance
```

The gate passes at 40 treatments / 80 images. Phase 3 may add treatments without
changing this frozen Phase 2 record.
