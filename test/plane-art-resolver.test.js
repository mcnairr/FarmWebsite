import assert from 'node:assert/strict';
import test from 'node:test';

import { planeAsset, planeArtwork, planeFamily } from '../plane-art.js';
import { planePose } from '../flight-feed-model.js';

test('planeFamily covers every Phase 1 ICAO family and class fallback', () => {
  const cases = [
    ['CRJ9', 'airliner', 'regional'],
    ['b738', 'other', 'narrowbody'],
    [' A359 ', 'other', 'widebody'],
    ['C25A', 'airliner', 'bizjet-small'],
    ['C172', 'airliner', 'cessna-high-wing'],
    ['AT8T', 'airliner', 'air-tractor'],
    [null, 'airliner', 'narrowbody'],
    [null, 'light', 'cessna-high-wing'],
    [null, 'other', 'bizjet-small'],
    [null, null, 'narrowbody'],
    ['../../A359', 'light', 'cessna-high-wing'],
  ];
  for (const [icao, aircraftClass, expected] of cases) {
    assert.equal(planeFamily(icao, aircraftClass), expected);
  }
});

test('planeArtwork covers all Phase 1 exact brand mappings', () => {
  const cases = [
    ['AAL1', 'B738', 'aal-narrowbody'], ['AAL2', 'B789', 'aal-widebody'],
    ['UAL1', 'A320', 'ual-narrowbody'], ['UAL2', 'B788', 'ual-widebody'],
    ['DAL1', 'A321', 'dal-narrowbody'], ['DAL2', 'A339', 'dal-widebody'],
    ['SWA1', 'B38M', 'swa-narrowbody'], ['FDX1', 'B763', 'fdx-widebody'],
    ['UPS1', 'B764', 'ups-widebody'], ['ENY1', 'E75L', 'american-eagle-regional'],
    ['JIA1', 'CRJ9', 'american-eagle-regional'],
    ['ASA1', 'B739', 'asa-narrowbody'], ['JBU1', 'A320', 'jbu-narrowbody'],
    ['FFT1', 'A321', 'fft-narrowbody'], ['NKS1', 'A319', 'nks-narrowbody'],
    ['AAY1', 'A320', 'aay-narrowbody'], ['SCX1', 'B738', 'scx-narrowbody'],
    ['HAL1', 'A321', 'hal-narrowbody'], ['HAL2', 'B789', 'hal-widebody'],
    ['ACA1', 'A223', 'aca-narrowbody'], ['ACA2', 'B788', 'aca-widebody'],
    ['WJA1', 'B38M', 'wja-narrowbody'], ['AMX1', 'B739', 'amx-narrowbody'],
    ['VOI1', 'A320', 'voi-narrowbody'],
  ];
  for (const [callsign, icaoType, expected] of cases) {
    assert.equal(planeArtwork({ callsign, icaoType, aircraftClass: 'airliner' }), expected);
  }
});

test('planeArtwork applies special, nearest-brand, and generic precedence', () => {
  const cases = [
    [{ callsign: 'AAL1', icaoType: 'C172', aircraftClass: 'light' }, 'cessna-high-wing'],
    [{ callsign: 'SWA1', icaoType: 'AT6T', aircraftClass: 'light' }, 'air-tractor-yellow'],
    [{ callsign: 'DAL1', icaoType: 'C25C', aircraftClass: 'other' }, 'generic-bizjet-small'],
    [{ callsign: 'AAL1', icaoType: 'A338', aircraftClass: 'airliner' }, 'aal-widebody'],
    [{ callsign: 'SWA1', icaoType: 'B739', aircraftClass: 'airliner' }, 'swa-narrowbody'],
    [{ callsign: 'FDX1', icaoType: 'B738', aircraftClass: 'airliner' }, 'generic-narrowbody'],
    [{ callsign: 'SKW1', icaoType: 'CRJ7', aircraftClass: 'airliner' }, 'generic-regional'],
    [{ callsign: null, icaoType: 'B789', aircraftClass: 'airliner' }, 'generic-widebody'],
    [{ callsign: null, icaoType: 'C525', aircraftClass: 'other' }, 'generic-bizjet-small'],
    [{ callsign: null, icaoType: 'C182', aircraftClass: 'light' }, 'cessna-high-wing'],
    [{ callsign: null, icaoType: 'AT3P', aircraftClass: 'light' }, 'air-tractor-yellow'],
  ];
  for (const [aircraft, expected] of cases) assert.equal(planeArtwork(aircraft), expected);
});

test('unknown and hostile values can select only authored generic assets', () => {
  const hostile = [null, undefined, '', '../aal', 'AAL/../../x', '<script>', 'AAL123.webp', 'AAL 123'];
  for (const value of hostile) {
    const artworkId = planeArtwork({ callsign: value, icaoType: value, aircraftClass: value });
    assert.equal(artworkId, 'generic-narrowbody');
    const asset = planeAsset(value, value);
    assert.equal(asset.artworkId, 'generic-narrowbody');
    assert.equal(asset.direction, 'right');
    assert.equal(asset.url, '/assets/planes/v1/generic-narrowbody-right.webp');
  }
});

test('planeAsset uses planePose direction to select independent manifest records', () => {
  const right = planeAsset('aal-narrowbody', planePose(90, 0).facing);
  const left = planeAsset('aal-narrowbody', planePose(270, 0).facing);
  assert.equal(right.key, 'aal-narrowbody:right');
  assert.equal(left.key, 'aal-narrowbody:left');
  assert.notEqual(right, left);
  assert.notEqual(right.url, left.url);
});

