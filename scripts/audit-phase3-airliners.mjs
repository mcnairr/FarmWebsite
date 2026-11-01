import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlaneArt } from './audit-phase1-plane-art.mjs';

export const PHASE3_AIRLINER_IDS = Object.freeze([
  'baw-widebody', 'dlh-widebody', 'afr-widebody', 'klm-widebody',
  'fdx-trijet', 'ups-trijet', 'gti-widebody', 'dhl-widebody',
  'dal-b717', 'dal-b757', 'ual-b787', 'aal-b777', 'dlh-b747', 'baw-a380',
  'jbu-a220', 'jbu-e190', 'united-express-crj200', 'delta-connection-crj900',
]);

export function auditPhase3Airliners(options = {}) {
  return auditPlaneArt({
    treatmentIds: PHASE3_AIRLINER_IDS,
    phase: 'Phase 3 airliners (PG-022)',
    ...options,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase3Airliners(), null, 2));
}
