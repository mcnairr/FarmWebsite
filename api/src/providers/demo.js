// @ts-check
// Fictional flights for designing and testing the homepage when no real
// aircraft are nearby. Only used when FLIGHT_FEED_DEMO=true, and never mixed
// with live data: the feed reports status "demo" and source "demo".

/** @typedef {import('../types.js').AircraftPosition} AircraftPosition */
/** @typedef {import('../types.js').FlightRoute} FlightRoute */

const AIRPORTS = {
  DEN: { icao: 'KDEN', iata: 'DEN', city: 'Denver', name: 'Denver International Airport', latitude: 39.8617, longitude: -104.6732 },
  ORD: { icao: 'KORD', iata: 'ORD', city: 'Chicago', name: "Chicago O'Hare International Airport", latitude: 41.9786, longitude: -87.9048 },
  SFO: { icao: 'KSFO', iata: 'SFO', city: 'San Francisco', name: 'San Francisco International Airport', latitude: 37.619, longitude: -122.3749 },
  EWR: { icao: 'KEWR', iata: 'EWR', city: 'Newark', name: 'Newark Liberty International Airport', latitude: 40.6925, longitude: -74.1687 },
  LAS: { icao: 'KLAS', iata: 'LAS', city: 'Las Vegas', name: 'Harry Reid International Airport', latitude: 36.08, longitude: -115.1522 },
  MCI: { icao: 'KMCI', iata: 'MCI', city: 'Kansas City', name: 'Kansas City International Airport', latitude: 39.2976, longitude: -94.7139 },
  MSP: { icao: 'KMSP', iata: 'MSP', city: 'Minneapolis', name: 'Minneapolis–Saint Paul International Airport', latitude: 44.882, longitude: -93.2218 },
  SLC: { icao: 'KSLC', iata: 'SLC', city: 'Salt Lake City', name: 'Salt Lake City International Airport', latitude: 40.7884, longitude: -111.9778 },
};

/**
 * Offsets (nm east, nm north of the farm) keep demo aircraft inside the
 * display radius wherever the farm reference point is configured.
 */
const DEMO_FLIGHTS = [
  { id: 'demo01', callsign: 'AAL2408', registration: 'N900DM', icaoType: 'B738', category: 'A3', east: -4, north: 2, alt: 35000, gs: 430, track: 82, vr: 0,
    route: { airline: 'American Airlines', airlineIcao: 'AAL', origin: AIRPORTS.DEN, destination: AIRPORTS.ORD } },
  { id: 'demo02', callsign: 'UAL3461', registration: 'N901DM', icaoType: 'B39M', category: 'A3', east: 14, north: 9, alt: 36000, gs: 456, track: 76, vr: 0,
    route: { airline: 'United Airlines', airlineIcao: 'UAL', origin: AIRPORTS.SFO, destination: AIRPORTS.EWR } },
  { id: 'demo03', callsign: 'SWA1896', registration: 'N902DM', icaoType: 'B38M', category: 'A3', east: -15, north: -7, alt: 32000, gs: 408, track: 94, vr: -800,
    route: { airline: 'Southwest Airlines', airlineIcao: 'SWA', origin: AIRPORTS.LAS, destination: AIRPORTS.MCI } },
  { id: 'demo04', callsign: 'DAL1127', registration: 'N903DM', icaoType: 'A321', category: 'A3', east: 9, north: -12, alt: 34000, gs: 445, track: 288, vr: 0,
    route: { airline: 'Delta Air Lines', airlineIcao: 'DAL', origin: AIRPORTS.MSP, destination: AIRPORTS.SLC } },
  { id: 'demo05', callsign: 'SKW5412', registration: 'N904DM', icaoType: 'E75L', category: 'A3', east: -20, north: 14, alt: 29000, gs: 390, track: 251, vr: 1200,
    route: null },
  { id: 'demo06', callsign: 'N7351D', registration: 'N7351D', icaoType: 'C172', category: 'A1', east: 1.5, north: -1, alt: 5500, gs: 105, track: 300, vr: 0,
    route: null },
  { id: 'demo07', callsign: 'FDX1243', registration: 'N905DM', icaoType: 'B763', category: 'A5', east: 22, north: -3, alt: 37000, gs: 470, track: 265, vr: 0,
    route: { airline: 'FedEx', airlineIcao: 'FDX', origin: AIRPORTS.MCI, destination: AIRPORTS.SFO } },
  { id: 'demo08', callsign: 'FFT2190', registration: 'N906DM', icaoType: 'A20N', category: 'A3', east: -9, north: -19, alt: 33000, gs: 438, track: 102, vr: 0,
    route: { airline: 'Frontier Airlines', airlineIcao: 'FFT', origin: AIRPORTS.DEN, destination: AIRPORTS.MCI } },
];

/**
 * Named scenarios for exercising UI edge cases: /api/flights?scenario=...
 * Only honoured in demo mode.
 */
export const DEMO_SCENARIOS = Object.freeze({
  default: ['demo01', 'demo02', 'demo03', 'demo06'],
  empty: [],
  one: ['demo01'],
  two: ['demo01', 'demo04'],
  four: ['demo01', 'demo02', 'demo03', 'demo04'],
  eight: DEMO_FLIGHTS.map((f) => f.id),
  noroute: ['demo05', 'demo06'],
  outage: null,
});

/** @typedef {keyof typeof DEMO_SCENARIOS} DemoScenario */

/**
 * @param {{ now?: () => number }} [options]
 */
export function createDemoProviders({ now = Date.now } = {}) {
  /** @type {import('../types.js').RouteProvider} */
  const routes = {
    async lookupRoute(callsign) {
      const flight = DEMO_FLIGHTS.find((f) => f.callsign === callsign);
      return flight?.route ? { callsign, ...flight.route } : null;
    },
  };

  return {
    routes,
    /**
     * @param {number} latitude @param {number} longitude
     * @param {DemoScenario} scenario
     * @returns {AircraftPosition[]}
     */
    positions(latitude, longitude, scenario) {
      const ids = DEMO_SCENARIOS[scenario];
      if (ids === null) throw new Error('demo outage scenario');
      // Drift each aircraft gently along its track, looping every 10 minutes
      // so demo planes never wander out of the display radius.
      const minutes = ((now() / 60_000) % 10) - 5;
      return DEMO_FLIGHTS.filter((f) => ids.includes(f.id)).map((f) => {
        const travelled = ((f.gs / 60) * minutes) / 6;
        const rad = (f.track * Math.PI) / 180;
        const north = f.north + travelled * Math.cos(rad);
        const east = f.east + travelled * Math.sin(rad);
        return {
          id: f.id,
          callsign: f.callsign,
          registration: f.registration,
          icaoType: f.icaoType,
          category: f.category,
          latitude: latitude + north / 60,
          longitude: longitude + east / (60 * Math.cos((latitude * Math.PI) / 180)),
          altitudeFt: f.alt,
          onGround: false,
          groundSpeedKt: f.gs,
          headingDeg: f.track,
          verticalRateFpm: f.vr,
          seenSeconds: 1,
          source: 'demo',
        };
      });
    },
  };
}
