# Phase 1 release and cold-cache baseline (PG-016)

Released: **2026-10-30**

Phase 1 consists of exactly **16 approved treatments and 32 independently
generated directional WebPs** in `assets/planes/v1/`. Every treatment has one
approved `right` record and one approved `left` record in the v1 manifest and
matching approved provenance records in `prompts.json`. The reproducible
library audit and validator are the inventory authority:

```sh
npm run plane-art:audit-phase1
npm run plane-art:validate
```

The public runtime reads only committed static files. Serving the homepage and
approved artwork does not authenticate to Google, call Vertex AI, incur model
billing, load a generation SDK, or require access to `.generated/`. Those
facilities are development inputs used only when creating replacement or later
phase artwork.

## Cold-cache behavior

The Phase 1 browser test establishes this functional cold-cache baseline:

- There is no full-library preload. The page requests the selected plane and
  only the distinct artwork URLs needed by visible blips.
- Multiple visible aircraft resolving to the same directional URL cause one
  image request, not one request per aircraft.
- Artwork for an unused airline/treatment is not requested.
- Selecting or promoting an aircraft whose URL has already loaded reuses the
  cached response; keyed blip DOM nodes also survive feed reconciliation.
- Image loading does not move the route layout.
- A missing or corrupt WebP switches to the category-appropriate inline SVG
  fallback without removing the route.

The deterministic three-aircraft fixture used by
`test/browser/plane-images.spec.js` has two distinct visible directional URLs,
so its empty-cache request set is exactly:

```text
/assets/planes/v1/generic-narrowbody-right.webp
/assets/planes/v1/aal-narrowbody-left.webp
```

This is a request-behavior baseline, not a network-speed claim. PG-017 owns
throttled mobile transfer and timing measurements for one, four, and eight
visible aircraft and will compare those results against this released slice.

## Clean-checkout release check

With Node.js 20 or newer, a clean checkout needs only the locked development
packages to validate and test the static release:

```sh
npm ci
npm run plane-art:validate
npm test
npx playwright install chromium   # once on a new machine
npm run test:browser
```

No Google credential, cloud project, Vertex endpoint, billing account, or
Google generation SDK is part of this procedure.
