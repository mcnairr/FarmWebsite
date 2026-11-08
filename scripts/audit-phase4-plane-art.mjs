import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlaneArt } from './audit-phase1-plane-art.mjs';

export const PHASE4_IDS = Object.freeze(['cirrus-vision-jet', 'citation-x']);

export function auditPhase4PlaneArt(options = {}) {
  return auditPlaneArt({ treatmentIds: PHASE4_IDS, phase: 'Phase 4 observed additions (PG-027)', ...options });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase4PlaneArt(), null, 2));
}
