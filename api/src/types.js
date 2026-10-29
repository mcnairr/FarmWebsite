// @ts-check
// Shared JSDoc types for the flight feed. Upstream schemas (adsb.lol,
// ADSBDB) are confined to their provider modules; everything downstream of a
// provider, including the browser, sees only the normalized shapes below.

/**
 * One aircraft record as returned by adsb.lol /v2/point. Every field is
 * optional and untrusted.
 *
 * @typedef {object} RawAdsbAircraft
 * @property {unknown} [hex]
 * @property {unknown} [type]
 * @property {unknown} [flight]
 * @property {unknown} [r]
 * @property {unknown} [t]
 * @property {unknown} [lat]
 * @property {unknown} [lon]
 * @property {unknown} [alt_baro] number, or the string "ground"
 * @property {unknown} [alt_geom]
 * @property {unknown} [gs]
 * @property {unknown} [track]
 * @property {unknown} [true_heading]
 * @property {unknown} [baro_rate]
 * @property {unknown} [geom_rate]
 * @property {unknown} [category]
 * @property {unknown} [seen]
 * @property {unknown} [seen_pos]
 */

/** @typedef {'adsb_lol' | 'mcnair_receiver' | 'demo'} FeedSource */

/**
 * Normalized live position from any AircraftProvider.
 *
 * @typedef {object} AircraftPosition
 * @property {string} id           ICAO 24-bit hex, lower case
 * @property {string | null} callsign
 * @property {string | null} registration
 * @property {string | null} icaoType
 * @property {string | null} category  ADS-B emitter category, e.g. "A3"
 * @property {number} latitude
 * @property {number} longitude
 * @property {number | null} altitudeFt
 * @property {boolean} onGround
 * @property {number | null} groundSpeedKt
 * @property {number | null} headingDeg
 * @property {number | null} verticalRateFpm
 * @property {number} seenSeconds   age of the position report
 * @property {FeedSource} source
 */

/**
 * @typedef {object} Airport
 * @property {string | null} icao
 * @property {string | null} iata
 * @property {string | null} city
 * @property {string | null} name
 * @property {number | null} latitude
 * @property {number | null} longitude
 */

/**
 * @typedef {object} FlightRoute
 * @property {string} callsign
 * @property {string | null} airline
 * @property {string | null} airlineIcao
 * @property {Airport | null} origin
 * @property {Airport | null} destination
 */

/**
 * @typedef {object} AircraftInfo
 * @property {string | null} registration
 * @property {string | null} icaoType
 * @property {string | null} manufacturer
 * @property {string | null} model
 */

/**
 * @typedef {object} PublicAirport
 * @property {string | null} icao
 * @property {string | null} iata
 * @property {string | null} city
 */

/**
 * One aircraft in the /api/flights response — the browser's contract.
 *
 * @typedef {object} NormalizedAircraft
 * @property {string} id
 * @property {string | null} callsign
 * @property {string | null} airline
 * @property {string | null} registration
 * @property {string | null} aircraftType  human readable, e.g. "Boeing 737-800"
 * @property {string | null} icaoType
 * @property {'airliner' | 'light' | 'other'} aircraftClass
 * @property {number | null} altitudeFt
 * @property {number | null} groundSpeedKt
 * @property {number | null} groundSpeedMph
 * @property {number | null} headingDeg
 * @property {number | null} verticalRateFpm
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} distanceFromFarmNm
 * @property {number} directionFromFarmDeg
 * @property {PublicAirport | null} origin
 * @property {PublicAirport | null} destination
 * @property {boolean} routeKnown
 * @property {number | null} routeProgress  0–1 along origin→destination
 * @property {number} dataAgeSeconds
 * @property {FeedSource} source
 */

/** @typedef {'live' | 'demo' | 'unavailable' | 'disabled'} FeedStatus */

/**
 * @typedef {object} FlightFeedResponse
 * @property {FeedStatus} status
 * @property {string} updatedAt     ISO timestamp of the position snapshot
 * @property {string} location
 * @property {number} displayRadiusNm
 * @property {number} refreshSeconds
 * @property {NormalizedAircraft[]} aircraft
 */

/**
 * @typedef {object} AircraftProvider
 * @property {FeedSource} source
 * @property {(latitude: number, longitude: number, radiusNm: number) => Promise<AircraftPosition[]>} getNearbyAircraft
 */

/**
 * @typedef {object} RouteProvider
 * @property {(callsign: string) => Promise<FlightRoute | null>} lookupRoute
 *   Resolves null when the route is unknown; rejects on transport failure.
 */

/**
 * @typedef {object} AircraftInfoProvider
 * @property {(hex: string) => Promise<AircraftInfo | null>} lookupAircraft
 */

export {};
