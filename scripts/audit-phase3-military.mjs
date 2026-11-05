import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlaneArt } from './audit-phase1-plane-art.mjs';

export const PHASE3_MILITARY_IDS = Object.freeze(['c130-military', 'c17-military', 'kc135-military']);

export function auditPhase3Military(options = {}) {
  return auditPlaneArt({ treatmentIds: PHASE3_MILITARY_IDS, phase: 'Phase 3 military aircraft (PG-025)', ...options });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditPhase3Military(), null, 2));
}
