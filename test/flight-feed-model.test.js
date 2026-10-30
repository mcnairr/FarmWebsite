import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airportLabel,
  compassAbbreviation,
  formatAltitude,
  formatSpeed,
  hasRoute,
  placeTraffic,
  planePose,
  reconcileSelection,
  routeLinePosition,
  stepSelection,
} from '../flight-feed-model.js';

const ids = ['a', 'b', 'c', 'd'];

test('next and previous wrap around', () => {
  assert.equal(stepSelection(ids, 'a', 1), 'b');
  assert.equal(stepSelection(ids, 'd', 1), 'a');
  assert.equal(stepSelection(ids, 'a', -1), 'd');
  assert.equal(stepSelection(ids, 'c', -1), 'b');
  assert.equal(stepSelection(['solo'], 'solo', 1), 'solo');
  assert.equal(stepSelection([], null, 1), null);
});

test('selection survives a refresh even when the order changes', () => {
  assert.equal(reconcileSelection('c', ids, ['d', 'c', 'a', 'b']), 'c');
});

test('when the selected aircraft leaves, the next one in the old order is chosen', () => {
  assert.equal(reconcileSelection('b', ids, ['a', 'c', 'd']), 'c');
  assert.equal(reconcileSelection('d', ids, ['a', 'b']), 'a', 'wraps to the start');
  assert.equal(reconcileSelection('b', ids, ['a', 'e']), 'a');
});

test('first data selects the first aircraft; empty data clears selection', () => {
  assert.equal(reconcileSelection(null, [], ['x', 'y']), 'x');
  assert.equal(reconcileSelection('x', ['x'], []), null);
});

test('formats altitude and speed for visitors', () => {
  assert.equal(formatAltitude(35000), '35,000 ft');
  assert.equal(formatAltitude(5500), '5,500 ft');
  assert.equal(formatAltitude(null), null);
  assert.equal(formatSpeed(494.8), '495 mph');
  assert.equal(formatSpeed(null), null);
});

test('formats headings as short compass directions', () => {
  assert.equal(compassAbbreviation(0), 'N');
  assert.equal(compassAbbreviation(22.5), 'NNE');
  assert.equal(compassAbbreviation(45), 'NE');
  assert.equal(compassAbbreviation(67.5), 'ENE');
  assert.equal(compassAbbreviation(112.5), 'ESE');
  assert.equal(compassAbbreviation(157.5), 'SSE');
  assert.equal(compassAbbreviation(181), 'S');
  assert.equal(compassAbbreviation(202.5), 'SSW');
  assert.equal(compassAbbreviation(247.5), 'WSW');
  assert.equal(compassAbbreviation(292.5), 'WNW');
  assert.equal(compassAbbreviation(315), 'NW');
  assert.equal(compassAbbreviation(337.5), 'NNW');
  assert.equal(compassAbbreviation(360), 'N');
});

test('airport label prefers city, falls back to code, never shows placeholders', () => {
  assert.deepEqual(airportLabel({ icao: 'KDEN', iata: 'DEN', city: 'Denver' }), { city: 'Denver', code: 'DEN' });
  assert.deepEqual(airportLabel({ icao: 'KDEN', iata: null, city: null }), { city: 'KDEN', code: null });
  assert.equal(airportLabel({ icao: null, iata: null, city: null }), null);
  assert.equal(airportLabel(null), null);
});

test('route row requires a known route with both ends', () => {
  const base = { routeKnown: true, origin: { icao: 'KDEN', iata: 'DEN', city: 'Denver' }, destination: { icao: 'KORD', iata: 'ORD', city: 'Chicago' } };
  assert.equal(hasRoute(base), true);
  assert.equal(hasRoute({ ...base, routeKnown: false }), false);
  assert.equal(hasRoute({ ...base, destination: null }), false);
});

test('side-view plane faces its direction of travel and is never upside down', () => {
  assert.deepEqual(planePose(82, 0), { facing: 'right', tiltDeg: 0 });
  assert.deepEqual(planePose(270, 0), { facing: 'left', tiltDeg: 0 });
  assert.equal(planePose(null, null).facing, 'right');
  // Climbing tilts the nose up in both directions, within a few degrees.
  assert.ok(planePose(90, 2000).tiltDeg < 0);
  assert.ok(planePose(270, 2000).tiltDeg > 0);
  assert.ok(Math.abs(planePose(90, 99999).tiltDeg) <= 5);
});

test('plane sits along the route line but clear of the city labels', () => {
  assert.equal(routeLinePosition(null), 0.5);
  assert.equal(routeLinePosition(0), 0.25);
  assert.equal(routeLinePosition(1), 0.75);
});

function ac(id, distanceFromFarmNm, directionFromFarmDeg) {
  return { id, distanceFromFarmNm, directionFromFarmDeg };
}

test('traffic layout reflects relative position and is deterministic', () => {
  const area = { width: 400, height: 300, radiusNm: 30 };
  const list = [ac('east', 20, 90), ac('north', 20, 0), ac('west', 20, 270)];
  const a = placeTraffic(list, area);
  const b = placeTraffic([...list].reverse(), area);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.ok(a.get('east').x > 200 && a.get('west').x < 200);
  assert.ok(a.get('north').y < 150);
});

test('traffic stays inside the area and out of the selected flight block', () => {
  const avoid = [{ left: 100, top: 100, right: 300, bottom: 200 }];
  const positions = placeTraffic([ac('center', 0, 0), ac('far', 30, 45), ac('near', 2, 180)], { width: 400, height: 300, radiusNm: 30, avoid });
  for (const { x, y } of positions.values()) {
    assert.ok(x >= 0 && x <= 400 && y >= 0 && y <= 300);
    const inside = x > avoid[0].left && x < avoid[0].right && y > avoid[0].top && y < avoid[0].bottom;
    assert.equal(inside, false, `(${x}, ${y}) overlaps the selected flight`);
  }
});
