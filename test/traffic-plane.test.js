import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createTrafficPlaneRenderer } from '../traffic-plane.js';

class FakeElement {
  attributes = new Map(); listeners = new Map(); hidden = false; setCounts = new Map();
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type) { this.listeners.get(type)?.(); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); this.setCounts.set(name, (this.setCounts.get(name) ?? 0) + 1); }
}
class FakeImage extends FakeElement { currentSrc = ''; width = 0; height = 0; }
class FakeFallback extends FakeElement { use = new FakeElement(); querySelector(s) { return s === 'use' ? this.use : null; } }

test('traffic plane reuses its directional production image across refreshes', () => {
  const image = new FakeImage(); const fallback = new FakeFallback();
  const renderer = createTrafficPlaneRenderer(image, fallback);
  const aircraft = { callsign: 'AAL123', icaoType: 'B738', aircraftClass: 'airliner' };
  renderer.render(aircraft, 'left');
  assert.equal(image.getAttribute('src'), '/assets/planes/v1/aal-narrowbody-left.webp');
  assert.equal(image.width, 960); assert.equal(image.height, 330);
  assert.equal(fallback.use.getAttribute('href'), '#ff-jet');
  image.dispatch('load');
  renderer.render({ ...aircraft, altitudeFt: 12_000 }, 'left');
  assert.equal(image.setCounts.get('src'), 1);
  assert.equal(fallback.hidden, true);
});

test('traffic plane failure uses the category fallback without retrying', () => {
  const image = new FakeImage(); const fallback = new FakeFallback();
  const renderer = createTrafficPlaneRenderer(image, fallback);
  const aircraft = { callsign: null, icaoType: 'C172', aircraftClass: 'light' };
  renderer.render(aircraft, 'right');
  assert.equal(image.getAttribute('src'), '/assets/planes/v1/cessna-high-wing-right.webp');
  assert.equal(fallback.use.getAttribute('href'), '#ff-prop');
  image.dispatch('error');
  assert.equal(image.hidden, true); assert.equal(fallback.hidden, false);
  renderer.render(aircraft, 'right');
  assert.equal(image.setCounts.get('src'), 1); assert.equal(fallback.hidden, false);
});

test('background traffic has no artwork mirroring', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('../flight-feed.js', import.meta.url), 'utf8'),
    readFile(new URL('../flight-feed.css', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /createTrafficPlaneRenderer/);
  assert.doesNotMatch(css, /ff-blip[^\n]*scaleX/);
  assert.doesNotMatch(css, /ff-blip\[data-facing/);
});
