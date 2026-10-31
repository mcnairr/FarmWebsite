// @ts-check

import { planeAsset, planeArtwork } from './plane-art.js';

/** @typedef {import('./api/src/types.js').NormalizedAircraft} Aircraft */

/**
 * Keep one keyed traffic image and its one-shot legacy fallback in sync.
 * @param {HTMLImageElement} image
 * @param {SVGElement} fallback
 */
export function createTrafficPlaneRenderer(image, fallback) {
  const fallbackUse = fallback.querySelector('use');
  let expectedUrl = null;

  image.addEventListener('load', () => {
    if (!isExpectedRequest(image, expectedUrl)) return;
    image.hidden = false;
    setSvgHidden(fallback, true);
  });
  image.addEventListener('error', () => {
    if (!isExpectedRequest(image, expectedUrl)) return;
    image.hidden = true;
    setSvgHidden(fallback, false);
  });

  return {
    /** @param {Aircraft} aircraft @param {'left' | 'right'} direction */
    render(aircraft, direction) {
      const asset = planeAsset(planeArtwork(aircraft), direction);
      const legacySymbol = aircraft.aircraftClass === 'light' ? '#ff-prop' : '#ff-jet';
      if (fallbackUse?.getAttribute('href') !== legacySymbol) fallbackUse?.setAttribute('href', legacySymbol);
      if (expectedUrl === asset.url) return asset;
      expectedUrl = asset.url;
      setSvgHidden(fallback, true);
      image.hidden = false;
      image.width = asset.width;
      image.height = asset.height;
      image.setAttribute('src', asset.url);
      return asset;
    },
  };
}

/** SVGElement.hidden is not consistently reflected to the hidden attribute. */
function setSvgHidden(element, hidden) {
  if (typeof element.toggleAttribute === 'function') element.toggleAttribute('hidden', hidden);
  else element.hidden = hidden;
}

/** @param {HTMLImageElement} image @param {string | null} expectedUrl */
function isExpectedRequest(image, expectedUrl) {
  if (!expectedUrl || image.getAttribute('src') !== expectedUrl) return false;
  if (!image.currentSrc || image.currentSrc === expectedUrl) return true;
  const baseUrl = image.baseURI || 'http://localhost/';
  return new URL(image.currentSrc, baseUrl).href === new URL(expectedUrl, baseUrl).href;
}
