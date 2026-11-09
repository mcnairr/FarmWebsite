// @ts-check
// Small in-memory TTL cache with request coalescing. Concurrent callers for
// the same key share one in-flight load, so many visitors arriving at once
// still produce a single upstream request.
//
// In a Cloudflare Worker this lives per isolate, which is enough for a
// low-traffic site. To share across isolates later, implement the same
// getOrLoad() contract on Workers KV or the Cache API.

export class TtlCache {
  /**
   * @param {{ maxEntries?: number, now?: () => number }} [options]
   */
  constructor({ maxEntries = 2000, now = Date.now } = {}) {
    /** @type {Map<string, { value: unknown, expires: number }>} */
    this.entries = new Map();
    /** @type {Map<string, Promise<unknown>>} */
    this.inflight = new Map();
    this.maxEntries = maxEntries;
    this.now = now;
  }

  /** @param {string} key */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** @param {string} key */
  has(key) {
    return this.get(key) !== undefined;
  }

  /** @param {string} key @param {unknown} value @param {number} ttlMs */
  set(key, value, ttlMs) {
    if (ttlMs <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /**
   * Return the cached value, or run `loader` once (shared by concurrent
   * callers) and cache its result for `ttlMs(value)`. A rejected loader is
   * not cached.
   *
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} loader
   * @param {(value: T) => number} ttlMs
   * @returns {Promise<T>}
   */
  getOrLoad(key, loader, ttlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(/** @type {T} */ (cached));
    const pending = this.inflight.get(key);
    if (pending) return /** @type {Promise<T>} */ (pending);

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs(value));
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }
}
