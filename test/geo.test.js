import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDeg, distanceNm, headingDifference, knotsToMph } from '../api/src/geo.js';

test('haversine distance between known airports', () => {
  // Denver (KDEN) to Chicago O'Hare (KORD) is about 770 nm great-circle.
  const d = distanceNm(39.8617, -104.6732, 41.9786, -87.9048);
  assert.ok(Math.abs(d - 770) < 8, `got ${d}`);
});

test('one degree of latitude is about 60 nm', () => {
  assert.ok(Math.abs(distanceNm(40, -101, 41, -101) - 60) < 0.2);
});

test('distance to self is zero', () => {
  assert.equal(distanceNm(40.5, -101.6, 40.5, -101.6), 0);
});

test('bearing points the right way', () => {
  assert.ok(Math.abs(bearingDeg(40, -101, 41, -101) - 0) < 0.01); // north
  assert.ok(Math.abs(bearingDeg(40, -101, 40, -100) - 90) < 1); // east
  assert.ok(Math.abs(bearingDeg(40, -101, 39, -101) - 180) < 0.01); // south
  assert.ok(Math.abs(bearingDeg(40, -101, 40, -102) - 270) < 1); // west
});

test('heading difference wraps around north', () => {
  assert.equal(headingDifference(350, 10), 20);
  assert.equal(headingDifference(10, 350), 20);
  assert.equal(headingDifference(90, 270), 180);
});

test('100 knots is about 115 mph', () => {
  assert.equal(Math.round(knotsToMph(100)), 115);
  assert.equal(Math.round(knotsToMph(430)), 495);
});
