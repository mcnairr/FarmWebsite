import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlaneArt } from './audit-phase1-plane-art.mjs';

export const PHASE3_SPECIALTY_IDS = Object.freeze([
  'thrush-yellow-blue', 'crop-duster-green', 'bell-206', 'bell-407',
  'h135-medical', 'police-helicopter', 'utility-helicopter',
]);

export function auditPhase3Specialty(options = {}) {
  return auditPlaneArt({ treatmentIds: PHASE3_SPECIALTY_IDS, phase: 'Phase 3 crop dusters and helicopters (PG-024)', ...options });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase3Specialty(), null, 2));
}
