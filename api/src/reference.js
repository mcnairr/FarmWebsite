// @ts-check
// Small hand-maintained display tables: common ICAO aircraft type
// designators and airline callsign prefixes seen over western Nebraska.
// They only make labels friendlier; anything missing falls back gracefully.

/** @type {Record<string, string>} */
const AIRCRAFT_TYPES = {
  A19N: 'Airbus A319neo', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo',
  A318: 'Airbus A318', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321',
  A332: 'Airbus A330-200', A333: 'Airbus A330-300', A339: 'Airbus A330-900neo',
  A359: 'Airbus A350-900', A35K: 'Airbus A350-1000', A388: 'Airbus A380',
  BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
  B712: 'Boeing 717', B733: 'Boeing 737-300', B734: 'Boeing 737-400', B735: 'Boeing 737-500',
  B736: 'Boeing 737-600', B737: 'Boeing 737-700', B738: 'Boeing 737-800', B739: 'Boeing 737-900',
  B37M: 'Boeing 737 MAX 7', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9', B3XM: 'Boeing 737 MAX 10',
  B744: 'Boeing 747-400', B748: 'Boeing 747-8', B752: 'Boeing 757-200', B753: 'Boeing 757-300',
  B762: 'Boeing 767-200', B763: 'Boeing 767-300', B764: 'Boeing 767-400',
  B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR', B773: 'Boeing 777-300', B77W: 'Boeing 777-300ER',
  B778: 'Boeing 777-8', B779: 'Boeing 777-9',
  B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10',
  CRJ2: 'Bombardier CRJ200', CRJ7: 'Bombardier CRJ700', CRJ9: 'Bombardier CRJ900', CRJX: 'Bombardier CRJ1000',
  E135: 'Embraer ERJ 135', E145: 'Embraer ERJ 145', E170: 'Embraer E170', E75L: 'Embraer E175',
  E75S: 'Embraer E175', E190: 'Embraer E190', E195: 'Embraer E195', E290: 'Embraer E190-E2',
  MD11: 'McDonnell Douglas MD-11', MD88: 'McDonnell Douglas MD-88', MD90: 'McDonnell Douglas MD-90',
  DH8D: 'De Havilland Dash 8-400', AT76: 'ATR 72-600',
  C172: 'Cessna 172 Skyhawk', C182: 'Cessna 182 Skylane', C206: 'Cessna 206', C208: 'Cessna 208 Caravan',
  C210: 'Cessna 210', C150: 'Cessna 150', C152: 'Cessna 152', C25A: 'Cessna Citation CJ2',
  C25B: 'Cessna Citation CJ3', C56X: 'Cessna Citation Excel', C68A: 'Cessna Citation Latitude',
  C700: 'Cessna Citation Longitude', C750: 'Cessna Citation X',
  PA28: 'Piper Cherokee', PA32: 'Piper Saratoga', PA46: 'Piper Malibu', P28A: 'Piper Cherokee',
  BE20: 'Beechcraft King Air 200', BE35: 'Beechcraft Bonanza', BE36: 'Beechcraft Bonanza',
  BE58: 'Beechcraft Baron', B350: 'Beechcraft King Air 350', BE9L: 'Beechcraft King Air 90',
  SR20: 'Cirrus SR20', SR22: 'Cirrus SR22', SF50: 'Cirrus Vision Jet',
  PC12: 'Pilatus PC-12', PC24: 'Pilatus PC-24', TBM9: 'Daher TBM 900', TBM7: 'Daher TBM 700',
  AT8T: 'Air Tractor AT-802', AT6T: 'Air Tractor AT-602', AT5T: 'Air Tractor AT-502',
  M20P: 'Mooney M20', AEST: 'Piper Aerostar', P46T: 'Piper Meridian', PAY3: 'Piper Cheyenne', BE40: 'Beechjet 400', CL30: 'Bombardier Challenger 300', CL35: 'Bombardier Challenger 350',
  CL60: 'Bombardier Challenger 600', GLF4: 'Gulfstream IV', GLF5: 'Gulfstream V', GLF6: 'Gulfstream G650',
  GLEX: 'Bombardier Global Express', E55P: 'Embraer Phenom 300', E50P: 'Embraer Phenom 100',
  LJ45: 'Learjet 45', LJ75: 'Learjet 75', H25B: 'Hawker 800',
  EC35: 'Airbus H135', EC45: 'Airbus H145', B407: 'Bell 407', B06: 'Bell 206', A109: 'Leonardo AW109',
  C130: 'Lockheed C-130 Hercules', C17: 'Boeing C-17 Globemaster', K35R: 'Boeing KC-135',
};

/** ICAO airline designator → display name. */
/** @type {Record<string, string>} */
const AIRLINES = {
  AAL: 'American Airlines', UAL: 'United Airlines', DAL: 'Delta Air Lines', SWA: 'Southwest Airlines',
  ASA: 'Alaska Airlines', JBU: 'JetBlue', FFT: 'Frontier Airlines', NKS: 'Spirit Airlines',
  AAY: 'Allegiant Air', SCX: 'Sun Country Airlines', HAL: 'Hawaiian Airlines', SKW: 'SkyWest Airlines',
  RPA: 'Republic Airways', ENY: 'Envoy Air', EDV: 'Endeavor Air', JIA: 'PSA Airlines',
  ASH: 'Mesa Airlines', QXE: 'Horizon Air', GJS: 'GoJet Airlines', AWI: 'Air Wisconsin',
  FDX: 'FedEx', UPS: 'UPS Airlines', GTI: 'Atlas Air', ABX: 'ABX Air', ATN: 'Air Transport International',
  ACA: 'Air Canada', WJA: 'WestJet', AMX: 'Aeroméxico', VOI: 'Volaris', BAW: 'British Airways',
  DLH: 'Lufthansa', AFR: 'Air France', KLM: 'KLM', EJA: 'NetJets', LXJ: 'Flexjet',
};

/** Emitter categories for light/small aircraft and rotorcraft. */
const LIGHT_CATEGORIES = new Set(['A1', 'A7', 'B1', 'B4', 'B6']);

/**
 * Human-readable aircraft type.
 * @param {string | null} icaoType
 * @param {{ manufacturer: string | null } | null} [info]
 */
export function aircraftTypeName(icaoType, info = null) {
  if (icaoType && AIRCRAFT_TYPES[icaoType]) return AIRCRAFT_TYPES[icaoType];
  if (icaoType && info?.manufacturer) return `${titleCase(info.manufacturer)} ${icaoType}`;
  return null;
}

/** @param {string | null} callsign */
export function airlineFromCallsign(callsign) {
  const match = callsign && /^([A-Z]{3})\d/.exec(callsign);
  return match ? AIRLINES[match[1]] ?? null : null;
}

/** Callsign shaped like a scheduled flight number (three-letter airline + digits). */
export function looksLikeAirlineFlight(callsign) {
  return !!callsign && /^[A-Z]{3}\d{1,4}[A-Z]?$/.test(callsign);
}

/**
 * Coarse visual class used to pick a silhouette.
 * @param {string | null} category @param {string | null} icaoType
 * @returns {'airliner' | 'light' | 'other'}
 */
export function aircraftClass(category, icaoType) {
  if (category && LIGHT_CATEGORIES.has(category)) return 'light';
  if (category === 'A3' || category === 'A4' || category === 'A5') return 'airliner';
  if (icaoType && /^(A3|A2|B7|BCS|CRJ|E1|E2|E7|MD|DH8|AT7)/.test(icaoType)) return 'airliner';
  if (icaoType && /^(C1|C2|PA|P28|BE|SR|M20|AT[5-8]T)/.test(icaoType)) return 'light';
  return 'other';
}

/** @param {string} s */
function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
