// @ts-check
// Structured application logs for Cloudflare Workers Logs. Keep request
// events free of client identifiers: Cloudflare already supplies invocation
// metadata, and the application only needs operational and flight data.

const BASE = Object.freeze({
  schemaVersion: 1,
  service: 'mcnair-flight-feed',
});

/**
 * @param {{ log?: (...args: unknown[]) => void, warn?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void }} [sink]
 */
export function createStructuredLogger(sink = console) {
  return {
    /** @param {string} event @param {Record<string, unknown>} [fields] */
    info(event, fields = {}) {
      (sink.log ?? console.log)({ ...BASE, severity: 'info', event, ...fields });
    },

    /** Existing feed warning interface plus structured, queryable fields. */
    warn(component, message, fields = {}) {
      (sink.warn ?? console.warn)({ ...BASE, severity: 'warning', event: 'application_failure', component, message, ...fields });
    },

    /** @param {string} event @param {unknown} err @param {Record<string, unknown>} [fields] */
    error(event, err, fields = {}) {
      const error = err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { name: 'Error', message: String(err) };
      (sink.error ?? console.error)({ ...BASE, severity: 'error', event, error, ...fields });
    },
  };
}
