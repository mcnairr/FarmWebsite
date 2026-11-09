// @ts-check
// Cloudflare Worker entry point. The app (and its in-memory cache) is
// created once per isolate and reused across requests.

import { createAppFromEnv } from './handler.js';

/** @type {ReturnType<typeof createAppFromEnv> | null} */
let app = null;

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string | undefined>} env
   * @param {{ waitUntil: (promise: Promise<unknown>) => void }} ctx
   */
  fetch(request, env, ctx) {
    app ??= createAppFromEnv(env);
    return app.handle(request, ctx);
  },
};
