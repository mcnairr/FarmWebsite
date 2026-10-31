import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createSelectedPlaneRenderer } from '../selected-plane.js';

class FakeClassList {
  values = new Set();
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) { force ? this.add(value) : this.remove(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  attributes = new Map();
  classList = new FakeClassList();
  listeners = new Map();
  hidden = false;
  style = { setProperty() {} };
  setCounts = new Map();

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type) { this.listeners.get(type)?.(); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this.setCounts.set(name, (this.setCounts.get(name) ?? 0) + 1);
  }
}

class FakeImage extends FakeElement {
  complete = false;
  currentSrc = '';
  naturalWidth = 0;
  width = 0;
  height = 0;
}

class FakeFallback extends FakeElement {
  use = new FakeElement();
  querySelector(selector) { return selector === 'use' ? this.use : null; }
}

test('selected plane requests the independent manifest asset and falls back once', () => {
  const image = new FakeImage();
  const fallback = new FakeFallback();
  const renderer = createSelectedPlaneRenderer(image, fallback);
  const jet = { callsign: 'AAL123', icaoType: 'B738', aircraftClass: 'airliner' };

  renderer.render(jet, 'left');
  assert.equal(image.getAttribute('src'), '/assets/planes/v1/aal-narrowbody-left.webp');
  assert.equal(image.width, 960);
  assert.equal(image.height, 330);
  assert.equal(image.classList.contains('is-loading'), true);
  assert.equal(fallback.use.getAttribute('href'), '#ff-jet');

  image.dispatch('error');
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);

  renderer.render(jet, 'left');
  assert.equal(image.setCounts.get('src'), 1, 'a feed refresh must not retry a failed asset');
  assert.equal(fallback.hidden, false);
});

test('switching selected planes hides stale art and ignores stale request events', () => {
  const image = new FakeImage();
  const fallback = new FakeFallback();
  const renderer = createSelectedPlaneRenderer(image, fallback);
  const jet = { callsign: 'AAL123', icaoType: 'B738', aircraftClass: 'airliner' };
  const prop = { callsign: null, icaoType: 'C172', aircraftClass: 'light' };

  renderer.render(jet, 'left');
  const oldUrl = image.getAttribute('src');
  renderer.render(prop, 'right');
  const newUrl = image.getAttribute('src');

  assert.equal(newUrl, '/assets/planes/v1/cessna-high-wing-right.webp');
  assert.equal(image.hidden, false);
  assert.equal(image.classList.contains('is-loading'), true);
  assert.equal(fallback.hidden, true);
  assert.equal(fallback.use.getAttribute('href'), '#ff-prop');
  assert.equal(image.classList.contains('is-light'), true);

  image.currentSrc = oldUrl;
  image.dispatch('error');
  assert.equal(fallback.hidden, true, 'an obsolete request must not replace the new image');

  image.currentSrc = newUrl;
  image.dispatch('load');
  assert.equal(image.classList.contains('is-loading'), false);
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
});

test('selected plane markup reserves space and does not lazy-load or mirror', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../flight-feed.css', import.meta.url), 'utf8'),
  ]);
  const image = html.match(/<img class="ff-plane ff-plane-image[^>]+>/)?.[0];

  assert.ok(image, 'selected plane image is missing');
  assert.match(image, /width="960" height="330"/);
  assert.match(image, /alt="" aria-hidden="true"/);
  assert.match(image, /decoding="async"/);
  assert.match(image, /fetchpriority="high"/);
  assert.doesNotMatch(image, /loading=/);
  assert.doesNotMatch(css, /ff-route\[data-facing="left"\] \.ff-plane/);
  assert.doesNotMatch(css, /--ff-flip/);
});
