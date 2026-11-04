import {
  buildMauticPageview,
  trackingDeniedByBrowser,
} from './shared-tracking-client.mjs';

const MARKETPLACE_ORIGIN = 'https://marketplace.registrystack.org';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ROUTES = [
  /^\/$/,
  /^\/contribute\/$/,
  /^\/privacy\/$/,
  /^\/collections\/$/,
  /^\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/,
  /^\/packs\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/,
  /^\/studio\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/,
];

export const MARKETPLACE_ACTIONS = Object.freeze([
  'download_intent',
  'request_submitted',
  'studio_instructions',
  'contribution_draft_open',
  'source_documentation',
  'pack_open',
  'contribute',
  'contribution_start',
  'category_filter',
]);

export function marketplaceAnalyticsConfig({ websiteId, scriptSrc } = {}) {
  const id = websiteId?.trim();
  const source = scriptSrc?.trim();
  if (!id && !source) return null;
  if (!id || !source || !UUID_PATTERN.test(id)) {
    throw new Error('Marketplace Umami analytics requires an explicit website ID and HTTPS script URL.');
  }
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error('Marketplace Umami analytics requires an explicit website ID and HTTPS script URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname === '/' ||
    !url.pathname.endsWith('.js')
  ) {
    throw new Error('Marketplace Umami analytics requires an explicit website ID and HTTPS script URL.');
  }
  return { websiteId: id, scriptSrc: url.toString(), domain: 'marketplace.registrystack.org' };
}

export function marketplaceCanonicalPath(value) {
  if (typeof value !== 'string' || value.length > 1100) return null;
  let url;
  try {
    url = new URL(value, MARKETPLACE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== MARKETPLACE_ORIGIN || url.username || url.password) return null;
  return PUBLIC_ROUTES.some(pattern => pattern.test(url.pathname)) ? url.pathname : null;
}

export function buildMarketplacePageview({ path, title, referrer }) {
  const canonicalPath = marketplaceCanonicalPath(path);
  if (!canonicalPath) throw new Error('Marketplace tracking requires a reviewed public route.');
  return buildMauticPageview({
    canonicalUrl: `${MARKETPLACE_ORIGIN}${canonicalPath}`,
    currentUrl: `${MARKETPLACE_ORIGIN}${canonicalPath}`,
    pageTitle: title,
    referrer,
  });
}

export function marketplaceTrackingAllowed({ state, navigator, now = Date.now() }) {
  return Boolean(
    state?.choice === 'accepted' &&
    state.generation &&
    Number.isSafeInteger(state.expiresAt) &&
    state.expiresAt > now &&
    !trackingDeniedByBrowser({ navigator }),
  );
}

export function marketplaceActionPayload(element, path) {
  const action = element?.dataset?.marketplaceAction;
  const sourcePath = marketplaceCanonicalPath(path);
  if (!MARKETPLACE_ACTIONS.includes(action) || !sourcePath) return null;
  const pack = element.dataset.marketplacePack ?? element.dataset.packId;
  if (pack !== undefined && (pack.length > 80 || !PUBLIC_SLUG_PATTERN.test(pack))) return null;
  return { action, source_path: sourcePath, ...(pack ? { pack } : {}) };
}

function marketplaceReferrerOrigin(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function marketplaceUmamiBeforeSend(type, payload) {
  if (type !== 'event' || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const url = marketplaceCanonicalPath(payload.url);
  if (!url) return false;
  return {
    ...payload,
    url,
    referrer: marketplaceReferrerOrigin(payload.referrer),
  };
}

export function trackMarketplaceAction(element, { path, umami } = {}) {
  const payload = marketplaceActionPayload(element, path);
  if (!payload || typeof umami?.track !== 'function') return false;
  umami.track('marketplace_action', payload);
  return true;
}

export function installMarketplaceActionTracking({
  document: currentDocument = globalThis.document,
  window: currentWindow = globalThis.window,
} = {}) {
  if (!currentDocument?.addEventListener || !currentWindow) return () => {};
  const listener = event => {
    const element = event.target instanceof Element
      ? event.target.closest('[data-marketplace-action]')
      : null;
    if (!element) return;
    trackMarketplaceAction(element, {
      path: currentWindow.location.pathname,
      umami: currentWindow.umami,
    });
  };
  currentDocument.addEventListener('click', listener);
  return () => currentDocument.removeEventListener('click', listener);
}
