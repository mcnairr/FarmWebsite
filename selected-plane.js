// @ts-check

import { planeAsset, planeArtwork } from './plane-art.js';

/** @typedef {import('./api/src/types.js').NormalizedAircraft} Aircraft */

/**
 * Keep the selected aircraft image and its one-shot legacy fallback in sync.
 * Re-rendering the same failed asset deliberately leaves the fallback in place
 * instead of retrying it on every feed refresh.
 *
 * @param {HTMLImageElement} image
 * @param {SVGElement} fallback
 */
export function createSelectedPlaneRenderer(image, fallback) {
  const fallbackUse = fallback.querySelector('use');
  /** @type {string | null} */
  let expectedUrl = null;

  image.addEventListener('load', () => {
    if (!isExpectedRequest(image, expectedUrl)) return;
    image.hidden = false;
    image.classList.remove('is-loading');
    fallback.hidden = true;
  });

  image.addEventListener('error', () => {
    if (!isExpectedRequest(image, expectedUrl)) return;
    image.hidden = true;
    fallback.hidden = false;
  });

  return {
    /** @param {Aircraft} aircraft @param {'left' | 'right'} direction */
    render(aircraft, direction) {
      const asset = planeAsset(planeArtwork(aircraft), direction);
      const isLight = aircraft.aircraftClass === 'light';
      const legacySymbol = isLight ? '#ff-prop' : '#ff-jet';

      image.classList.toggle('is-light', isLight);
      fallback.classList.toggle('is-light', isLight);
      if (fallbackUse?.getAttribute('href') !== legacySymbol) {
        fallbackUse?.setAttribute('href', legacySymbol);
      }

      // Preserve a successful image or one-shot fallback across data refreshes.
      if (expectedUrl === asset.url) return asset;

      expectedUrl = asset.url;
      fallback.hidden = true;
      image.hidden = false;
      image.classList.add('is-loading');
      image.width = asset.width;
      image.height = asset.height;
      image.setAttribute('src', asset.url);

      // Cached images may already be complete before the load listener runs.
      if (image.complete && image.naturalWidth > 0 && isExpectedRequest(image, expectedUrl)) {
        image.classList.remove('is-loading');
      }
      return asset;
    },
  };
}

/** @param {HTMLImageElement} image @param {string | null} expectedUrl */
function isExpectedRequest(image, expectedUrl) {
  if (!expectedUrl || image.getAttribute('src') !== expectedUrl) return false;
  if (!image.currentSrc || image.currentSrc === expectedUrl) return true;
  const baseUrl = image.baseURI || 'http://localhost/';
  return new URL(image.currentSrc, baseUrl).href === new URL(expectedUrl, baseUrl).href;
}
