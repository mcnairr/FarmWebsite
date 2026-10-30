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
    approvalStatus: 'approved',
  },
  {
    key: 'aal-narrowbody:left', artworkId: 'aal-narrowbody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/aal-narrowbody-left.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['AAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'aal-narrowbody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'aal-widebody:right', artworkId: 'aal-widebody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/aal-widebody-right.webp',
    width: 960, height: 330, sizeClass: 'x-large',
    applicableIcaoTypes: ['B772', 'B773', 'B77L', 'B77W', 'B788', 'B789', 'B78X'],
    allowedCallsignPrefixes: ['AAL'], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'aal-widebody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'aal-widebody:left', artworkId: 'aal-widebody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/aal-widebody-left.webp',
    width: 960, height: 330, sizeClass: 'x-large',
    applicableIcaoTypes: ['B772', 'B773', 'B77L', 'B77W', 'B788', 'B789', 'B78X'],
    allowedCallsignPrefixes: ['AAL'], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'aal-widebody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'ual-narrowbody:right', artworkId: 'ual-narrowbody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/ual-narrowbody-right.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['UAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'ual-narrowbody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'ual-narrowbody:left', artworkId: 'ual-narrowbody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/ual-narrowbody-left.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['UAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'ual-narrowbody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'ual-widebody:right', artworkId: 'ual-widebody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/ual-widebody-right.webp',
    width: 960, height: 330, sizeClass: 'x-large',
    applicableIcaoTypes: ['B772', 'B773', 'B77L', 'B77W', 'B788', 'B789', 'B78X'],
    allowedCallsignPrefixes: ['UAL'], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'ual-widebody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'ual-widebody:left', artworkId: 'ual-widebody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/ual-widebody-left.webp',
    width: 960, height: 330, sizeClass: 'x-large',
    applicableIcaoTypes: ['B772', 'B773', 'B77L', 'B77W', 'B788', 'B789', 'B78X'],
    allowedCallsignPrefixes: ['UAL'], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'ual-widebody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'dal-narrowbody:right', artworkId: 'dal-narrowbody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/dal-narrowbody-right.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['DAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'dal-narrowbody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'dal-narrowbody:left', artworkId: 'dal-narrowbody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/dal-narrowbody-left.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['A319', 'A320', 'A321', 'B37M', 'B38M', 'B39M', 'B737', 'B738', 'B739'],
    allowedCallsignPrefixes: ['DAL'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'dal-narrowbody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'dal-widebody:right', artworkId: 'dal-widebody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/dal-widebody-right.webp',
    width: 960, height: 330, sizeClass: 'x-large',
    applicableIcaoTypes: ['A332', 'A333', 'A338', 'A339', 'A359'],
    allowedCallsignPrefixes: ['DAL'], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'dal-widebody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'dal-widebody:left', artworkId: 'dal-widebody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/dal-widebody-left.webp',
    width: 960, height: 330, sizeClass: 'x-large',
    applicableIcaoTypes: ['A332', 'A333', 'A338', 'A339', 'A359'],
    allowedCallsignPrefixes: ['DAL'], fallbackId: 'legacy-svg-jet',
    promptRecordKey: 'dal-widebody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'swa-narrowbody:right', artworkId: 'swa-narrowbody', direction: 'right',
    category: 'scheduled-passenger', url: '/assets/planes/v1/swa-narrowbody-right.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['B37M', 'B38M', 'B737', 'B738'],
    allowedCallsignPrefixes: ['SWA'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'swa-narrowbody:right:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
  },
  {
    key: 'swa-narrowbody:left', artworkId: 'swa-narrowbody', direction: 'left',
    category: 'scheduled-passenger', url: '/assets/planes/v1/swa-narrowbody-left.webp',
    width: 960, height: 330, sizeClass: 'large',
    applicableIcaoTypes: ['B37M', 'B38M', 'B737', 'B738'],
    allowedCallsignPrefixes: ['SWA'], fallbackId: 'generic-narrowbody',
    promptRecordKey: 'swa-narrowbody:left:v1', generationModel: 'gemini-3.1-flash-image',
    approvalStatus: 'approved',
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
