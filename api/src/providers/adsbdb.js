// @ts-check
// RouteProvider and AircraftInfoProvider backed by the public ADSBDB API.
// Route data is looked up on demand and only held in a short-lived memory
// cache; it must not be copied into a persistent database (see README).

import { fetchJson, UpstreamError } from '../http.js';
import * as clean from '../sanitize.js';

/** @typedef {import('../types.js').FlightRoute} FlightRoute */
/** @typedef {import('../types.js').Airport} Airport */
/** @typedef {import('../types.js').AircraftInfo} AircraftInfo */

/**
 * @param {{ baseUrl: string, timeoutMs: number, fetchImpl?: typeof fetch }} options
 * @returns {import('../types.js').RouteProvider & import('../types.js').AircraftInfoProvider}
 */
export function createAdsbdbProvider({ baseUrl, timeoutMs, fetchImpl }) {
  /** @param {string} path */
  async function get(path) {
    const { status, body } = await fetchJson('adsbdb', `${baseUrl}${path}`, { timeoutMs, fetchImpl });
    if (status === 404) return null;
    if (!clean.isObject(body) || !clean.isObject(body.response)) {
      throw new UpstreamError('adsbdb', 'unexpected response shape');
    }
    return body.response;
  }

  return {
    async lookupRoute(callsign) {
      const cs = clean.callsign(callsign);
      if (!cs) return null;
      const response = await get(`/v0/callsign/${encodeURIComponent(cs)}`);
      return response ? parseAdsbdbRoute(response.flightroute, cs) : null;
    },
    async lookupAircraft(hex) {
      const id = clean.hex(hex);
      if (!id || id.startsWith('~')) return null;
      const response = await get(`/v0/aircraft/${encodeURIComponent(id)}`);
      return response ? parseAdsbdbAircraft(response.aircraft) : null;
    },
  };
}

/**
 * @param {unknown} raw  the `flightroute` object
 * @param {string} callsign
 * @returns {FlightRoute | null}
 */
export function parseAdsbdbRoute(raw, callsign) {
  if (!clean.isObject(raw)) return null;
  const airline = clean.isObject(raw.airline) ? raw.airline : null;
  const origin = parseAirport(raw.origin);
  const destination = parseAirport(raw.destination);
  const airlineName = airline ? clean.text(airline.name, 60) : null;
  if (!origin && !destination && !airlineName) return null;
  return {
    callsign: clean.callsign(raw.callsign_icao) ?? clean.callsign(raw.callsign) ?? callsign,
    airline: airlineName,
    airlineIcao: airline ? clean.airportCode(airline.icao, 3) : null,
    origin,
    destination,
  };
}

/** @param {unknown} raw @returns {Airport | null} */
function parseAirport(raw) {
  if (!clean.isObject(raw)) return null;
  const airport = {
    icao: clean.airportCode(raw.icao_code, 4),
    iata: clean.airportCode(raw.iata_code, 3),
    city: clean.text(raw.municipality, 40),
    name: clean.text(raw.name, 80),
    latitude: clean.finite(raw.latitude, -90, 90),
    longitude: clean.finite(raw.longitude, -180, 180),
  };
  return airport.icao || airport.iata || airport.city ? airport : null;
}

/** @param {unknown} raw  the `aircraft` object @returns {AircraftInfo | null} */
export function parseAdsbdbAircraft(raw) {
  if (!clean.isObject(raw)) return null;
  return {
    registration: clean.registration(raw.registration),
    icaoType: clean.icaoType(raw.icao_type),
    manufacturer: clean.text(raw.manufacturer, 40),
    model: clean.text(raw.type, 40),
  };
}
