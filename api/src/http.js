// @ts-check

/** Upstream request failure with enough context to log, never sent to browsers. */
export class UpstreamError extends Error {
  /** @param {string} service @param {string} message @param {number | null} [status] */
  constructor(service, message, status = null) {
    super(`${service}: ${message}`);
    this.name = 'UpstreamError';
    this.service = service;
    this.status = status;
  }
}

/**
 * GET a JSON document with a hard timeout.
 * Resolves `{ status, body }` for 2xx and 404 (so callers can treat "unknown"
 * as data); rejects with UpstreamError for timeouts, other statuses, and
 * malformed JSON.
 *
 * @param {string} service  short name for logs
 * @param {string} url
 * @param {{ timeoutMs: number, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{ status: number, body: unknown }>}
 */
export async function fetchJson(service, url, { timeoutMs, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': 'mcnair-farms.com flight feed' },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = controller.signal.aborted;
    throw new UpstreamError(service, timedOut ? `timed out after ${timeoutMs} ms` : `network error (${errorName(err)})`);
  }

  try {
    if (!response.ok && response.status !== 404) {
      throw new UpstreamError(service, `HTTP ${response.status}`, response.status);
    }
    const text = await response.text();
    try {
      return { status: response.status, body: JSON.parse(text) };
    } catch {
      if (response.status === 404) return { status: 404, body: null };
      throw new UpstreamError(service, 'malformed JSON', response.status);
    }
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(service, controller.signal.aborted ? `timed out after ${timeoutMs} ms` : 'failed reading body');
  } finally {
    clearTimeout(timer);
  }
}

/** @param {unknown} err */
function errorName(err) {
  return err instanceof Error ? err.name : 'unknown';
}

/**
 * Logger that reports each distinct message key at most once per interval,
 * so a sustained outage doesn't write a line every poll.
 *
 * @param {{ intervalMs?: number, now?: () => number, sink?: (msg: string) => void }} [options]
 */
export function createThrottledLogger({ intervalMs = 5 * 60_000, now = Date.now, sink = console.warn } = {}) {
  /** @type {Map<string, { last: number, suppressed: number }>} */
  const seen = new Map();
  return {
    /** @param {string} key @param {string} message */
    warn(key, message) {
      const t = now();
      const entry = seen.get(key);
      if (entry && t - entry.last < intervalMs) {
        entry.suppressed++;
        return;
      }
      const extra = entry?.suppressed ? ` (${entry.suppressed} similar suppressed)` : '';
      seen.set(key, { last: t, suppressed: 0 });
      sink(`[flight-feed] ${message}${extra}`);
    },
  };
}
