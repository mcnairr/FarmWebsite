# Phase 1 mobile performance decision (PG-017)

Measured **2026-10-30** with Chromium, a 844 × 390 mobile viewport at 2× device
scale, 4× CPU slowdown, 150 ms latency, 1.6 Mbps download, and 750 Kbps upload.
The repeatable harness is `npm run plane-art:measure-performance`; raw output is
written to `test-results/plane-art-performance.json`.

| Visible aircraft | Asset mix | Cold WebP requests | Cold WebP bytes | Cold image-ready | Warm transferred | Warm image-ready |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | unique | 1 | 46.3 KiB | 2.79 s | 0 B | 1.33 s |
| 4 | unique | 4 | 194.1 KiB | 3.53 s | 0 B | 1.35 s |
| 4 | duplicate | 1 | 47.4 KiB | 2.75 s | 0 B | 1.37 s |
| 8 | unique | 8 | 374.3 KiB | 4.74 s | 0 B | 1.37 s |
| 8 | duplicate | 1 | 47.4 KiB | 2.75 s | 0 B | 1.36 s |

`image-ready` includes navigation, API work, image download, decode, and render;
it is deliberately a user-facing upper bound rather than network transfer time.
All visible images completed and decoded in every run. Cumulative layout shift
was 0.0049–0.0114 for the whole page, below the 0.1 "good" threshold; the
existing delayed-image browser test separately confirms that plane loading does
not move the route layout.

The request set was exactly the selected aircraft plus visible unique blip URLs.
Duplicate fixtures transferred one WebP regardless of aircraft count, and no
unused treatment was requested. Warm reloads served every WebP from browser
cache with zero transferred image bytes. The browser integration test also
promotes an already visible blip and changes selections without another request,
proving cache reuse for those interactions.

## Decision

Keep the shared 960 × 330 hero/blip WebP strategy. The worst intentionally
adversarial eight-unique fixture remains usable under the throttled profile,
while the more representative four-aircraft view reaches image-ready in 3.53 s
cold and 1.35 s warm. Derivative blip images would add generation, review,
manifest, and invalidation complexity without a measured failure: warm transfer
is zero, duplicate traffic already collapses to one response, CLS is good, and
the cold request set is demand-driven. No derivative-image follow-up issue is
justified by these results.

No idle prefetch was added. The runtime continues to prohibit full-library
preload and requests only artwork that is currently visible.
