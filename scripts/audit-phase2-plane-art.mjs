import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlaneArt, PHASE1_TREATMENT_IDS } from './audit-phase1-plane-art.mjs';

export const PHASE2_ADDITION_IDS = Object.freeze([
  'asa-narrowbody', 'jbu-narrowbody', 'fft-narrowbody', 'nks-narrowbody',
  'aay-narrowbody', 'scx-narrowbody', 'hal-narrowbody', 'hal-widebody',
  'aca-narrowbody', 'aca-widebody', 'wja-narrowbody', 'amx-narrowbody',
  'voi-narrowbody', 'delta-connection-regional', 'united-express-regional',
  'alaska-regional', 'netjets-bizjet', 'flexjet-bizjet',
  'generic-bizjet-large', 'cessna-caravan', 'piper-low-wing', 'king-air',
  'dash8', 'air-tractor-red-white',
]);

export const PHASE2_TREATMENT_IDS = Object.freeze([
  ...PHASE1_TREATMENT_IDS,
  ...PHASE2_ADDITION_IDS,
]);

export function auditPhase2PlaneArt(options = {}) {
  return auditPlaneArt({
    treatmentIds: PHASE2_TREATMENT_IDS,
    phase: 'Phase 2',
    ...options,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase2PlaneArt(), null, 2));
}
