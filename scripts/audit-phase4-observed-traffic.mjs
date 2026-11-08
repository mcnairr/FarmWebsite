#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { PLANE_ASSETS } from '../assets/planes/v1/manifest.js';
import { planeArtwork } from '../plane-art.js';

const UNKNOWN = 'unknown';
// Preserve the resolver state that existed during the PG-027 observation
// window so rerunning the audit after promotion still reproduces the decision.
const PRE_PG027_ARTWORK = Object.freeze({ SF50: 'cessna-high-wing', C750: 'generic-bizjet-small' });
const KNOWN_ICAO_TYPES = new Set(PLANE_ASSETS
  .flatMap((asset) => asset.applicableIcaoTypes)
  .filter((icaoType) => !Object.hasOwn(PRE_PG027_ARTWORK, icaoType)));

function safeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : UNKNOWN;
}

function safeIcaoType(value) {
  const normalized = safeText(value).toUpperCase();
  return /^[A-Z0-9]{2,4}$/.test(normalized) ? normalized : UNKNOWN;
}

function callsignPrefix(value) {
  const normalized = safeText(value).toUpperCase();
  return /^[A-Z]{3}[A-Z0-9]{1,5}$/.test(normalized) ? normalized.slice(0, 3) : UNKNOWN;
}

function publicAircraftKey(source) {
  const key = safeText(source.aircraftKey);
  return key !== UNKNOWN ? key : safeText(source.aircraftId);
}

function groupKey(record) {
  return [record.callsignPrefix, record.icaoType, record.aircraftClass, record.existingArtwork].join('|');
}

/**
 * Build a privacy-safe aggregate from Workers Observability events. Aircraft
 * identifiers are used only to deduplicate polling and are never returned.
 *
 * @param {unknown[]} events
 */
export function analyzeObservedTraffic(events) {
  const aircraft = new Map();
  let observationEvents = 0;
  let firstTimestamp = Infinity;
  let lastTimestamp = -Infinity;

  for (const event of events) {
    if (event?.source?.event !== 'aircraft_observed' || !Number.isFinite(event.timestamp)) continue;
    const source = event.source;
    const aircraftKey = publicAircraftKey(source);
    if (aircraftKey === UNKNOWN) continue;
    observationEvents += 1;
    firstTimestamp = Math.min(firstTimestamp, event.timestamp);
    lastTimestamp = Math.max(lastTimestamp, event.timestamp);

    let record = aircraft.get(aircraftKey);
    if (!record) {
      const icaoType = safeIcaoType(source.icaoType);
      const candidate = {
        callsign: safeText(source.callsign),
        icaoType,
        aircraftClass: safeText(source.aircraftClass),
      };
      const existingArtwork = PRE_PG027_ARTWORK[icaoType] ?? planeArtwork(candidate);
      record = {
        callsignPrefix: callsignPrefix(source.callsign),
        icaoType,
        aircraftClass: candidate.aircraftClass,
        airline: safeText(source.airline),
        equipment: safeText(source.equipment),
        existingArtwork,
        observations: 0,
      };
      aircraft.set(aircraftKey, record);
    }
    record.observations += 1;
  }

  const groups = new Map();
  for (const record of aircraft.values()) {
    const key = groupKey(record);
    let group = groups.get(key);
    if (!group) {
      group = {
        callsignPrefix: record.callsignPrefix,
        icaoType: record.icaoType,
        aircraftClass: record.aircraftClass,
        airline: record.airline,
        equipment: record.equipment,
        existingArtwork: record.existingArtwork,
        distinctAircraft: 0,
        observations: 0,
        genericFallback: record.existingArtwork.startsWith('generic-'),
        unrecognizedIcaoType: record.icaoType !== UNKNOWN && !KNOWN_ICAO_TYPES.has(record.icaoType),
      };
      groups.set(key, group);
    }
    group.distinctAircraft += 1;
    group.observations += record.observations;
  }

  const candidates = [...groups.values()]
    .filter((group) => group.genericFallback || group.unrecognizedIcaoType || group.icaoType === UNKNOWN)
    .sort((a, b) => b.distinctAircraft - a.distinctAircraft
      || b.observations - a.observations
      || a.callsignPrefix.localeCompare(b.callsignPrefix)
      || a.icaoType.localeCompare(b.icaoType));

  const countAircraft = (items) => items.reduce((total, item) => total + item.distinctAircraft, 0);

  return {
    schemaVersion: 1,
    observationPeriod: observationEvents ? {
      from: new Date(firstTimestamp).toISOString(),
      to: new Date(lastTimestamp).toISOString(),
    } : null,
    observationEvents,
    distinctAircraft: aircraft.size,
    candidateGroups: candidates.length,
    candidateAircraft: countAircraft(candidates),
    genericFallbackAircraft: countAircraft(candidates.filter((candidate) => candidate.genericFallback)),
    unrecognizedIcaoAircraft: countAircraft(candidates.filter((candidate) => candidate.unrecognizedIcaoType)),
    unknownIcaoAircraft: countAircraft(candidates.filter((candidate) => candidate.icaoType === UNKNOWN)),
    candidates,
  };
}

async function readEvents(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.jsonl')).sort();
  const events = [];
  for (const file of files) {
    const lines = (await readFile(path.join(directory, file), 'utf8')).split(/\r?\n/).filter(Boolean);
    for (const line of lines) events.push(JSON.parse(line));
  }
  return events;
}

export async function main(argv = process.argv.slice(2)) {
  const directory = path.resolve(argv[0] ?? 'worker-logs');
  const report = analyzeObservedTraffic(await readEvents(directory));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
