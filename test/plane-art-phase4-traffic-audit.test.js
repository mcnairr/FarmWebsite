import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeObservedTraffic } from '../scripts/audit-phase4-observed-traffic.mjs';

function observed(timestamp, fields) {
  return { timestamp, source: { event: 'aircraft_observed', ...fields } };
}

test('PG-027 audit deduplicates polling and emits only privacy-safe aggregates', () => {
  const events = [
    observed(Date.parse('2026-11-01T10:00:00Z'), {
      aircraftKey: 'N-PRIVATE-1', aircraftId: 'abc001', callsign: 'SKW123', icaoType: 'E75L',
      aircraftClass: 'airliner', airline: 'SkyWest Airlines', equipment: 'Embraer E175',
    }),
    observed(Date.parse('2026-11-01T10:00:10Z'), {
      aircraftKey: 'N-PRIVATE-1', aircraftId: 'abc001', callsign: 'SKW123', icaoType: 'E75L',
      aircraftClass: 'airliner', airline: 'SkyWest Airlines', equipment: 'Embraer E175',
    }),
    observed(Date.parse('2026-11-01T10:01:00Z'), {
      aircraftKey: 'N-PRIVATE-2', aircraftId: 'abc002', callsign: 'UAL456', icaoType: 'A21N',
      aircraftClass: 'airliner', airline: 'United Airlines', equipment: 'Airbus A321neo',
    }),
    observed(Date.parse('2026-11-01T10:01:30Z'), {
      aircraftKey: 'N-PRIVATE-3', aircraftId: 'abc003', callsign: 'N123AB', icaoType: 'SF50',
      aircraftClass: 'light', airline: 'unknown', equipment: 'Cirrus Vision Jet',
    }),
    { timestamp: Date.parse('2026-11-01T10:02:00Z'), source: { event: 'http_response' } },
  ];

  const report = analyzeObservedTraffic(events);
  assert.equal(report.observationEvents, 4);
  assert.equal(report.distinctAircraft, 3);
  assert.equal(report.candidateGroups, 3);
  assert.equal(report.candidateAircraft, 3);
  assert.equal(report.genericFallbackAircraft, 1);
  assert.equal(report.unrecognizedIcaoAircraft, 2);
  assert.equal(report.unknownIcaoAircraft, 0);
  assert.deepEqual(report.observationPeriod, {
    from: '2026-11-01T10:00:00.000Z', to: '2026-11-01T10:01:30.000Z',
  });
  assert.deepEqual(report.candidates.map((candidate) => ({
    prefix: candidate.callsignPrefix,
    type: candidate.icaoType,
    artwork: candidate.existingArtwork,
    distinct: candidate.distinctAircraft,
    observations: candidate.observations,
  })), [
    { prefix: 'SKW', type: 'E75L', artwork: 'generic-regional', distinct: 1, observations: 2 },
    { prefix: 'UAL', type: 'A21N', artwork: 'ual-narrowbody', distinct: 1, observations: 1 },
    { prefix: 'unknown', type: 'SF50', artwork: 'cessna-high-wing', distinct: 1, observations: 1 },
  ]);
  assert.doesNotMatch(JSON.stringify(report), /N-PRIVATE|abc00|SKW123|UAL456/);
});

test('PG-027 audit treats an empty input as a valid zero-observation report', () => {
  assert.deepEqual(analyzeObservedTraffic([]), {
    schemaVersion: 1,
    observationPeriod: null,
    observationEvents: 0,
    distinctAircraft: 0,
    candidateGroups: 0,
    candidateAircraft: 0,
    genericFallbackAircraft: 0,
    unrecognizedIcaoAircraft: 0,
    unknownIcaoAircraft: 0,
    candidates: [],
  });
});
