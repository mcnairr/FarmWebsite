import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/dev-server.mjs', '--demo', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (chunk) => chunk.toString().includes('McNair Farms preview:') && resolve());
  server.once('exit', (code) => reject(new Error(`preview server exited (${code})`)));
});

const profiles = [
  ['one-unique', 'one'], ['four-unique', 'four'], ['four-duplicate', 'four-duplicate'],
  ['eight-unique', 'eight'], ['eight-duplicate', 'eight-duplicate'],
];
const browser = await chromium.launch();
const results = [];

try {
  for (const [name, scenario] of profiles) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750, connectionType: 'cellular3g' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const run = async (temperature) => {
      const records = new Map();
      const cached = new Set();
      const onRequest = ({ requestId, request }) => request.url.includes('/assets/planes/v1/') && request.url.endsWith('.webp') && records.set(requestId, { url: new URL(request.url).pathname, bytes: 0 });
      const onCache = ({ requestId }) => cached.add(requestId);
      const onFinished = ({ requestId, encodedDataLength }) => { if (records.has(requestId)) records.get(requestId).bytes = encodedDataLength; };
      cdp.on('Network.requestWillBeSent', onRequest); cdp.on('Network.requestServedFromCache', onCache); cdp.on('Network.loadingFinished', onFinished);
      const started = performance.now();
      await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#flight-feed')?.dataset.state === 'demo' && [...document.querySelectorAll('.ff-plane-image,.ff-blip-image')].filter((image) => !image.hidden).every((image) => image.complete));
      await page.evaluate(() => Promise.all([...document.querySelectorAll('.ff-plane-image,.ff-blip-image')].filter((image) => !image.hidden).map((image) => image.decode?.().catch(() => {}))));
      const readyMs = Math.round(performance.now() - started);
      await page.waitForTimeout(100);
      cdp.off('Network.requestWillBeSent', onRequest); cdp.off('Network.requestServedFromCache', onCache); cdp.off('Network.loadingFinished', onFinished);
      const entries = [...records.entries()];
      return {
        temperature, readyMs,
        visibleAircraft: await page.locator('.ff-plane-image:visible,.ff-blip-image:visible').count(),
        imageRequests: entries.length,
        uniqueUrls: new Set(entries.map(([, record]) => record.url)).size,
        transferredBytes: entries.reduce((sum, [, record]) => sum + record.bytes, 0),
        cacheHits: entries.filter(([id]) => cached.has(id)).length,
        cls: await page.evaluate(() => Number(window.__cls.toFixed(4))),
      };
    };
    const cold = await run('cold');
    const warm = await run('warm');
    results.push({ name, cold, warm });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}

const report = { measuredAt: new Date().toISOString(), profile: { viewport: '844x390 @2x', latencyMs: 150, downloadKbps: 1600, uploadKbps: 750, cpuSlowdown: 4 }, results };
await writeFile('test-results/plane-art-performance.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
