// Shared test doubles.

/** @param {unknown} body @param {number} [status] */
export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * fetch() stand-in that records calls.
 * @param {(url: string, init: RequestInit) => Response | Promise<Response>} respond
 */
export function fakeFetch(respond) {
  const impl = async (url, init) => {
    impl.calls.push(String(url));
    return respond(String(url), init);
  };
  /** @type {string[]} */
  impl.calls = [];
  return impl;
}

/** Controllable clock. */
export function fakeClock(start = Date.parse('2026-10-28T23:00:00Z')) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  return now;
}

export const quietLogger = { warn() {} };
