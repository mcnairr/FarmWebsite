import { expect, test } from '@playwright/test';

const airport = (code, city) => ({
  icao: `K${code}`, iata: code, city, name: `${city} Airport`, latitude: 40, longitude: -100,
});

function aircraft(id, overrides = {}) {
  return {
    id, callsign: `TST${id}`, airline: null, registration: `N${id}`,
    aircraftType: 'Test aircraft', icaoType: 'B738', aircraftClass: 'airliner',
    altitudeFt: 30_000, groundSpeedMph: 440, headingDeg: 90, verticalRateFpm: 0,
    distanceFromFarmNm: 5, directionFromFarmDeg: 90,
    origin: airport('DEN', 'Denver'), destination: airport('ORD', 'Chicago'),
    routeKnown: true,
    routeProgress: 0.5, distanceFromOriginNm: 450, distanceToDestinationNm: 450,
    source: 'demo', ...overrides,
  };
}

function feed(items) {
  return { status: 'demo', generatedAt: new Date().toISOString(), refreshSeconds: 10, displayRadiusNm: 30, aircraft: items };
}

async function mockFeed(page, getItems) {
  await page.route('**/api/flights**', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify(feed(getItems())),
  }));
}

async function waitForFeed(page) {
  await page.goto('/');
  await expect(page.locator('#flight-feed')).toHaveAttribute('data-state', 'demo');
  await expect(page.locator('.ff-plane-image')).toHaveAttribute('src', /\/assets\/planes\/v1\//);
}

test('loads directional jet, propeller, and generic artwork in hero and blips', async ({ page }) => {
  const items = [
    aircraft('01', { callsign: 'AAL101', headingDeg: 90 }),
    aircraft('02', { callsign: 'UAL202', icaoType: 'B39M', headingDeg: 270 }),
    aircraft('03', { callsign: 'N303', icaoType: 'C172', aircraftClass: 'light', headingDeg: 300 }),
    aircraft('04', { callsign: 'FFT404', icaoType: 'A20N', headingDeg: 80 }),
  ];
  await mockFeed(page, () => items);
  await waitForFeed(page);

  await expect(page.locator('.ff-plane-image')).toHaveAttribute('src', '/assets/planes/v1/aal-narrowbody-right.webp');
  await expect(page.locator('.ff-blip[data-id="02"] img')).toHaveAttribute('src', '/assets/planes/v1/ual-narrowbody-left.webp');
  await expect(page.locator('.ff-blip[data-id="03"] img')).toHaveAttribute('src', '/assets/planes/v1/cessna-high-wing-left.webp');
  await expect(page.locator('.ff-blip[data-id="04"] img')).toHaveAttribute('src', '/assets/planes/v1/generic-narrowbody-right.webp');
  await expect(page.locator('.ff-plane-image')).toHaveJSProperty('naturalWidth', 960);

  await page.locator('.ff-blip[data-id="03"]').click();
  await expect(page.locator('.ff-plane-image')).toHaveAttribute('src', '/assets/planes/v1/cessna-high-wing-left.webp');
  await expect(page.locator('.ff-plane-image')).toBeVisible();
  await expect(page.locator('.ff-blip[data-id="01"] img')).toHaveAttribute('src', '/assets/planes/v1/aal-narrowbody-right.webp');
});

test('uses category SVG fallbacks for missing and corrupt files without emptying the route', async ({ page }) => {
  const items = [
    aircraft('jet', { callsign: 'AAL500', headingDeg: 90 }),
    aircraft('prop', { callsign: 'N500P', icaoType: 'C172', aircraftClass: 'light', headingDeg: 270 }),
  ];
  await page.route('**/assets/planes/v1/aal-narrowbody-right.webp', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
    status: 404, contentType: 'text/plain', body: 'missing',
    });
  });
  await page.route('**/assets/planes/v1/cessna-high-wing-left.webp', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ status: 200, contentType: 'image/webp', body: 'corrupt-image-data' });
  });
  await mockFeed(page, () => items);
  await waitForFeed(page);

  await expect(page.locator('.ff-plane-image')).toBeHidden();
  await expect(page.locator('.ff-plane-fallback')).toBeVisible();
  await expect(page.locator('.ff-plane-fallback use')).toHaveAttribute('href', '#ff-jet');
  await expect(page.locator('.ff-route')).toHaveClass(/has-route/);
  await expect(page.locator('.ff-from')).toBeVisible();
  await expect(page.locator('.ff-to')).toBeVisible();

  await page.locator('.ff-blip[data-id="prop"]').click();
  await expect(page.locator('.ff-plane-image')).toBeHidden();
  await expect(page.locator('.ff-plane-fallback')).toBeVisible();
  await expect(page.locator('.ff-plane-fallback use')).toHaveAttribute('href', '#ff-prop');
  await expect(page.locator('.ff-route')).toHaveClass(/has-route/);
});

test('requests only visible unique art, reuses cache and keyed blips, and does not shift while images load', async ({ page }) => {
  let items = [
    aircraft('selected', { callsign: 'FFT100', icaoType: 'A20N', headingDeg: 90 }),
    aircraft('same-art', { callsign: 'FFT200', icaoType: 'A20N', headingDeg: 90, distanceFromFarmNm: 7 }),
    aircraft('aal', { callsign: 'AAL300', headingDeg: 270, distanceFromFarmNm: 9 }),
  ];
  const requests = [];
  let releaseImages;
  const imageGate = new Promise((resolve) => { releaseImages = resolve; });
  await page.route('**/assets/planes/v1/*.webp', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await imageGate;
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'cache-control': 'public, max-age=31536000, immutable' } });
  });
  await mockFeed(page, () => items);
  await waitForFeed(page);

  await page.evaluate(() => {
    window.__blipNodes = Object.fromEntries([...document.querySelectorAll('.ff-blip')].map((node) => [node.dataset.id, node]));
  });
  const before = await page.locator('.ff-route').boundingBox();
  releaseImages();
  await expect(page.locator('.ff-plane-image')).toHaveJSProperty('naturalWidth', 960);
  const after = await page.locator('.ff-route').boundingBox();
  expect(after).toEqual(before);

  expect(new Set(requests)).toEqual(new Set([
    '/assets/planes/v1/generic-narrowbody-right.webp',
    '/assets/planes/v1/aal-narrowbody-left.webp',
  ]));
  expect(requests).not.toContain('/assets/planes/v1/dal-narrowbody-right.webp');
  expect(requests.length).toBeLessThan(16 * 2);

  await page.locator('.ff-blip[data-id="same-art"]').click();
  await expect(page.locator('.ff-plane-image')).toHaveAttribute('src', '/assets/planes/v1/generic-narrowbody-right.webp');
  expect(requests.filter((url) => url.endsWith('generic-narrowbody-right.webp'))).toHaveLength(1);

  items = [items[0], { ...items[1], distanceFromFarmNm: 12 }, { ...items[2], distanceFromFarmNm: 3 }];
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.ff-blip')].every(
    (node) => !window.__blipNodes[node.dataset.id] || window.__blipNodes[node.dataset.id] === node,
  ))).toBe(true);
  expect(requests.filter((url) => url.endsWith('generic-narrowbody-right.webp'))).toHaveLength(1);
});
