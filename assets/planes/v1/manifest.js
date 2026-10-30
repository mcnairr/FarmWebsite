// Browser-safe, hand-authored plane artwork metadata. This module must remain
// static: callers look up authored URLs and never construct paths from API data.

export const PLANE_MANIFEST_VERSION = 1;

export const PLANE_DIRECTIONS = Object.freeze(['left', 'right']);
export const PLANE_CATEGORIES = Object.freeze([
  'scheduled-passenger', 'cargo', 'business', 'general-aviation',
  'turboprop', 'crop-duster', 'helicopter', 'military',
]);
export const PLANE_SIZE_CLASSES = Object.freeze(['small', 'medium', 'large', 'x-large']);
export const PLANE_APPROVAL_STATUSES = Object.freeze([
  'planned', 'candidate', 'approved', 'rejected', 'retired',
]);

// Terminal rendering fallbacks implemented by the existing inline SVGs.
export const LEGACY_PLANE_FALLBACKS = Object.freeze(['legacy-svg-jet', 'legacy-svg-prop']);

// PG-002 contract examples. Later generation issues add records without
// changing the shape of existing records or their stable keys.
export const PLANE_ASSETS = Object.freeze([
  {
    key: 'aal-narrowbody:right', artworkId: 'aal-narrowbody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/aal-narrowbody-right.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['AAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'aal-narrowbody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'planned',
  },
  {
    key: 'aal-narrowbody:left', artworkId: 'aal-narrowbody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/aal-narrowbody-left.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['AAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'aal-narrowbody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'planned',
  },
  {
    key: 'generic-narrowbody:right', artworkId: 'generic-narrowbody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/generic-narrowbody-right.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: [], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'generic-narrowbody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'planned',
  },
  {
    key: 'generic-narrowbody:left', artworkId: 'generic-narrowbody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/generic-narrowbody-left.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: [], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'generic-narrowbody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'planned',
  },
  {
    key: 'cessna-high-wing:right', artworkId: 'cessna-high-wing', direction: 'right',
    category: 'general-aviation', url: '/assets/planes/v1/cessna-high-wing-right.webp',
    width: 960, height: 330, sizeClass: 'small',
    applicableIcaoTypes: ['C150', 'C152', 'C172', 'C182', 'C206'],
    allowedCallsignPrefixes: [], fallbackId: 'legacy-svg-prop',
    promptRecordKey: 'cessna-high-wing:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'planned',
  },
  {
    key: 'cessna-high-wing:left', artworkId: 'cessna-high-wing', direction: 'left',
    category: 'general-aviation', url: '/assets/planes/v1/cessna-high-wing-left.webp',
    width: 960, height: 330, sizeClass: 'small',
    applicableIcaoTypes: ['C150', 'C152', 'C172', 'C182', 'C206'],
    allowedCallsignPrefixes: [], fallbackId: 'legacy-svg-prop',
    promptRecordKey: 'cessna-high-wing:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'planned',
  },
]);

export const PLANE_ASSETS_BY_KEY = Object.freeze(Object.fromEntries(
  PLANE_ASSETS.map((asset) => [asset.key, asset]),
));
