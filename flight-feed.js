// @ts-check
// Homepage live flight feed. Polls our own flight API (never the public
// ADS-B services directly) and updates the sky overlay in place. The page
// is fully usable before, without, and after this script: if the endpoint
// isn't configured or anything fails, the farm photo is left untouched.

import {
  airportLabel,
  compassAbbreviation,
  compassWord,
  displayTitle,
  formatAltitude,
  formatDistance,
  formatSpeed,
  hasRoute,
  placeTraffic,
  planePose,
  reconcileSelection,
  routeLinePosition,
  stepSelection,
} from './flight-feed-model.js';

/** @typedef {import('./api/src/types.js').NormalizedAircraft} Aircraft */
/** @typedef {import('./api/src/types.js').FlightFeedResponse} FeedResponse */
/** @typedef {'connecting' | 'live' | 'demo' | 'reconnecting' | 'unavailable'} ViewState */

/** Keep showing the last aircraft through brief outages, but not stale ones. */
const KEEP_LAST_DATA_MS = 45_000;
const REQUEST_TIMEOUT_MS = 8_000;
const SWITCH_MS = 180;
const MAX_BLIPS_NARROW = 4;

const endpoint = document.querySelector('meta[name="flight-feed-endpoint"]')?.getAttribute('content')?.trim();
const root = document.getElementById('flight-feed');
if (endpoint && root) start(endpoint, root).catch(() => root.remove());

/** @param {string} endpointUrl @param {HTMLElement} root */
async function start(endpointUrl, root) {
  await loadStylesheet(new URL('flight-feed.css', import.meta.url).href);
  const $ = (/** @type {string} */ sel) => /** @type {HTMLElement} */ (root.querySelector(sel));
  const el = {
    sky: $('.ff-sky'),
    traffic: $('.ff-traffic'),
    flight: $('.ff-flight'),
    card: $('.ff-card'),
    position: $('.ff-position'),
    callsign: $('.ff-callsign'),
    airline: $('.ff-airline'),
    type: $('.ff-type'),
    metrics: $('.ff-card-metrics'),
    altitude: $('.ff-altitude'),
    speed: $('.ff-speed'),
    heading: $('.ff-heading'),
    route: $('.ff-route'),
    from: $('.ff-from'),
    to: $('.ff-to'),
    lineDone: $('.ff-line-done'),
    lineAhead: $('.ff-line-ahead'),
    plane: $('.ff-plane'),
    steps: /** @type {HTMLButtonElement[]} */ ([...root.querySelectorAll('.ff-step')]),
    badge: $('.ff-badge-text'),
    announcer: $('.ff-announcer'),
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** @type {Aircraft[]} */
  let aircraft = [];
  /** @type {string | null} */
  let selectedId = null;
  /** @type {string | null} */
  let renderedId = null;
  let lastSuccess = 0;
  let failures = 0;
  let refreshMs = 15_000;
  let radiusNm = 30;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {Map<string, HTMLButtonElement>} */
  const blips = new Map();

  root.hidden = false;
  document.querySelector('.flight-credit')?.removeAttribute('hidden');
  setState('connecting');

  // ----- data -----

  async function poll() {
    clearTimeout(timer);
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    // True when our API answered that upstream data is unavailable, as
    // opposed to the request itself failing (possibly transiently).
    let reportedUnavailable = false;
    try {
      const res = await fetch(endpointUrl, { signal: controller.signal, headers: { accept: 'application/json' } });
      /** @type {FeedResponse} */
      const data = await res.json();
      if (data?.status === 'unavailable') {
        reportedUnavailable = true;
        throw new Error('upstream unavailable');
      }
      if (!res.ok || !data || !Array.isArray(data.aircraft)) throw new Error('bad response');
      if (data.status === 'disabled') {
        root.hidden = true;
        return;
      }
      failures = 0;
      lastSuccess = Date.now();
      refreshMs = clamp((data.refreshSeconds || 15) * 1000, 10_000, 120_000);
      radiusNm = data.displayRadiusNm || radiusNm;
      setState(data.status === 'demo' ? 'demo' : 'live');
      update(data.aircraft.filter(isAircraft));
    } catch {
      failures++;
      if (Date.now() - lastSuccess < KEEP_LAST_DATA_MS) {
        setState('reconnecting');
      } else if (reportedUnavailable || lastSuccess || failures > 1) {
        setState('unavailable');
        update([]);
      }
      // Otherwise the very first request failed: stay "connecting" and retry.
    } finally {
      clearTimeout(abort);
      if (!document.hidden && !root.hidden) {
        const backoff = failures ? Math.min(60_000, refreshMs * 2 ** (failures - 1)) : refreshMs;
        timer = setTimeout(poll, backoff);
      }
    }
  }

  // Don't poll in background tabs; refresh as soon as the visitor returns.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else if (!root.hidden) poll();
  });

  // ----- state -> view -----

  // With no aircraft, or no data, the sky is simply left empty: no message.

  /** @param {ViewState} state */
  function setState(state) {
    root.dataset.state = state;
    renderBadge();
  }

  /** Registration and position of the selected aircraft relative to the farm. */
  function renderBadge() {
    const state = /** @type {ViewState} */ (root.dataset.state);
    const selected = aircraft.find((a) => a.id === selectedId);
    if (!selected || (state !== 'live' && state !== 'demo' && state !== 'reconnecting')) {
      el.badge.textContent = '';
      return;
    }
    const aircraftName = selected.registration ?? displayTitle(selected);
    const distance = formatDistance(selected.distanceFromFarmNm);
    el.badge.textContent = distance === 'Overhead'
      ? `${aircraftName} is overhead the farm.`
      : `${aircraftName} is ${distance} ${compassWord(selected.directionFromFarmDeg)} of the farm.`;
  }

  /** @param {Aircraft[]} next */
  function update(next) {
    const previousIds = aircraft.map((a) => a.id);
    aircraft = next;
    selectedId = reconcileSelection(selectedId, previousIds, next.map((a) => a.id));
    renderSelected(false);
  }

  /** @param {boolean} userInitiated */
  function renderSelected(userInitiated) {
    const index = aircraft.findIndex((a) => a.id === selectedId);
    const selected = index >= 0 ? aircraft[index] : null;
    const single = aircraft.length < 2;
    setText(el.position, selected && !single ? `${index + 1} of ${aircraft.length}` : null);
    for (const button of el.steps) button.hidden = single;
    el.card.classList.toggle('is-single', single);

    if (!selected) {
      el.flight.hidden = true;
      renderedId = null;
      renderTraffic();
      return;
    }

    const changed = renderedId !== null && renderedId !== selected.id;
    renderedId = selected.id;
    el.flight.hidden = false; // before renderTraffic(), which measures it
    if (changed && !reducedMotion.matches) {
      el.flight.classList.add('is-switching');
      setTimeout(() => {
        fillFlight(selected);
        el.flight.classList.remove('is-switching');
        renderTraffic();
      }, SWITCH_MS);
    } else {
      fillFlight(selected);
      renderTraffic();
    }

    if (userInitiated) el.announcer.textContent = describe(selected, index, aircraft.length);
  }

  /** @param {Aircraft} a */
  function fillFlight(a) {
    renderBadge();
    setText(el.callsign, displayTitle(a));
    setText(el.airline, a.airline);
    setText(el.type, a.aircraftType);
    const altitude = formatAltitude(a.altitudeFt);
    const speed = formatSpeed(a.groundSpeedMph);
    const heading = a.headingDeg === null ? null : `${compassAbbreviation(a.headingDeg)} (${a.headingDeg}°)`;
    setText(el.altitude, altitude);
    setText(el.speed, speed);
    setText(el.heading, heading);
    el.metrics.hidden = !altitude && !speed && !heading;

    const pose = planePose(a.headingDeg, a.verticalRateFpm);
    el.route.dataset.facing = pose.facing;
    el.plane.style.setProperty('--ff-tilt', `${pose.tiltDeg}deg`);
    const symbol = a.aircraftClass === 'light' ? '#ff-prop' : '#ff-jet';
    const use = el.plane.querySelector('use');
    if (use && use.getAttribute('href') !== symbol) use.setAttribute('href', symbol);
    el.plane.classList.toggle('is-light', a.aircraftClass === 'light');

    const routed = hasRoute(a);
    el.route.classList.toggle('has-route', routed);
    fillEnd(el.from, routed ? airportLabel(a.origin) : null);
    fillEnd(el.to, routed ? airportLabel(a.destination) : null);
    const position = routed ? routeLinePosition(a.routeProgress) : 0.5;
    el.lineDone.style.flexGrow = String(position);
    el.lineAhead.style.flexGrow = String(1 - position);
  }

  /** @param {HTMLElement} end @param {{ city: string, code: string | null } | null} label */
  function fillEnd(end, label) {
    end.hidden = !label;
    setText(/** @type {HTMLElement} */ (end.querySelector('.ff-city')), label?.city ?? null);
    setText(/** @type {HTMLElement} */ (end.querySelector('.ff-code')), label?.code ?? null);
  }

  /** Small unselected aircraft, keyed by id so refreshes move them rather than rebuild them. */
  function renderTraffic() {
    const area = el.traffic.getBoundingClientRect();
    // Narrow screens have little open sky; show the most relevant few there.
    // Every aircraft stays reachable through the card's ‹ › buttons.
    const others = aircraft.filter((a) => a.id !== selectedId).slice(0, area.width < 600 ? MAX_BLIPS_NARROW : undefined);
    // Keep small planes clear of the whole selected-flight block (card,
    // details, route) as one region so they settle in open sky around it.
    const parts = [el.card, el.details, el.route].filter((n) => !n.hidden).map((n) => n.getBoundingClientRect());
    const avoid = el.flight.hidden || parts.length === 0
      ? []
      : [{
          left: Math.min(...parts.map((r) => r.left)) - area.left,
          top: Math.min(...parts.map((r) => r.top)) - area.top,
          right: Math.max(...parts.map((r) => r.right)) - area.left,
          bottom: Math.max(...parts.map((r) => r.bottom)) - area.top,
        }];
    const positions = placeTraffic(others, { width: area.width, height: area.height, radiusNm, avoid });

    for (const [id, node] of blips) {
      if (!positions.has(id)) {
        blips.delete(id);
        node.classList.add('is-leaving');
        setTimeout(() => node.remove(), 600);
      }
    }
    for (const a of others) {
      const pos = positions.get(a.id);
      if (!pos) continue;
      let node = blips.get(a.id);
      if (!node) {
        node = document.createElement('button');
        node.type = 'button';
        node.tabIndex = -1; // the ‹ › buttons are the keyboard path; these are a pointer shortcut
        node.className = 'ff-blip is-entering';
        node.innerHTML = '<svg viewBox="0 0 320 110" focusable="false"><use></use></svg>';
        node.addEventListener('click', () => select(/** @type {string} */ (node?.dataset.id)));
        node.dataset.id = a.id;
        el.traffic.append(node);
        blips.set(a.id, node);
        requestAnimationFrame(() => node?.classList.remove('is-entering'));
      }
      const pose = planePose(a.headingDeg, a.verticalRateFpm);
      node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      node.dataset.facing = pose.facing;
      node.classList.toggle('is-light', a.aircraftClass === 'light');
      node.querySelector('use')?.setAttribute('href', a.aircraftClass === 'light' ? '#ff-prop' : '#ff-jet');
    }
  }

  // ----- interaction -----

  /** @param {string} id */
  function select(id) {
    if (!aircraft.some((a) => a.id === id) || id === selectedId) return;
    selectedId = id;
    renderSelected(true);
  }

  /** @param {number} delta */
  function step(delta) {
    const next = stepSelection(aircraft.map((a) => a.id), selectedId, delta);
    if (next) select(next);
  }

  // ‹ and › on either side of the card step through nearby aircraft; arrow
  // keys do the same while anything in the card has focus.
  for (const button of el.steps) {
    button.addEventListener('click', () => step(Number(button.dataset.step)));
  }
  el.card.addEventListener('keydown', (event) => {
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && aircraft.length > 1) {
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  // Horizontal swipe across the sky on touch screens.
  /** @type {{ x: number, y: number } | null} */
  let touchStart = null;
  el.sky.addEventListener('pointerdown', (e) => {
    touchStart = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  });
  el.sky.addEventListener('pointerup', (e) => {
    if (!touchStart || aircraft.length < 2) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) step(dx < 0 ? 1 : -1);
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderTraffic);
  });

  poll();
}

// ----- helpers -----

/** @param {HTMLElement} node @param {string | null | undefined} value */
function setText(node, value) {
  if (node.textContent !== (value ?? '')) node.textContent = value ?? '';
  node.hidden = !value;
}

/**
 * Screen-reader summary announced after manual navigation.
 * @param {Aircraft} a @param {number} index @param {number} total
 */
function describe(a, index, total) {
  const route = hasRoute(a) ? `from ${airportLabel(a.origin)?.city} to ${airportLabel(a.destination)?.city}` : null;
  const text = [displayTitle(a), a.airline, route, formatAltitude(a.altitudeFt), formatSpeed(a.groundSpeedMph)].filter(Boolean).join(', ');
  return `Aircraft ${index + 1} of ${total}: ${text}`;
}

/** Minimal shape check on data from the network. @param {unknown} a @returns {a is Aircraft} */
function isAircraft(a) {
  return (
    typeof a === 'object' && a !== null &&
    typeof (/** @type {Aircraft} */ (a).id) === 'string' &&
    Number.isFinite(/** @type {Aircraft} */ (a).distanceFromFarmNm) &&
    Number.isFinite(/** @type {Aircraft} */ (a).directionFromFarmDeg)
  );
}

/** @param {number} n @param {number} min @param {number} max */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** @param {string} href */
function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.append(link);
  });
}
