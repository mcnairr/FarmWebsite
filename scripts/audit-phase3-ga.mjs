import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlaneArt } from './audit-phase1-plane-art.mjs';

export const PHASE3_GA_IDS = Object.freeze([
  'cirrus-low-wing', 'beech-piston', 'pilatus-pc12',
  'daher-tbm', 'atr', 'generic-twin-piston',
]);

export function auditPhase3Ga(options = {}) {
  return auditPlaneArt({ treatmentIds: PHASE3_GA_IDS, phase: 'Phase 3 GA and turboprops (PG-023)', ...options });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase3Ga(), null, 2));
}
