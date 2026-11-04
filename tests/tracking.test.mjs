import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from '@astrojs/compiler';

import {
  MARKETPLACE_ACTIONS,
  buildMarketplacePageview,
  marketplaceActionPayload,
  marketplaceAnalyticsConfig,
  marketplaceCanonicalPath,
  marketplaceTrackingAllowed,
  marketplaceUmamiBeforeSend,
  trackMarketplaceAction,
} from '../src/tracking/marketplace-tracking.mjs';
import {
  TRACKING_ALLOWED_ORIGINS,
  TRACKING_ASSOCIATION_ORIGIN,
  TRACKING_CONSENT_STORAGE_KEY,
  TRACKING_IDENTITY_STORAGE_KEY,
  TRACKING_LOCAL_REFUSAL_STORAGE_KEY,
  TRACKING_PROTOCOL_VERSION,
} from '../src/tracking/tracking-protocol.mjs';
import { trackingDeniedByBrowser } from '../src/tracking/shared-tracking-client.mjs';

const root = new URL('../', import.meta.url);

test('preserves the deployed protocol while marketplace enrollment stays broker-owned', () => {
  assert.equal(TRACKING_PROTOCOL_VERSION, 2);
  assert.deepEqual(TRACKING_ALLOWED_ORIGINS, [
    'https://registrystack.org',
    'https://docs.registrystack.org',
  ]);
  assert.equal(TRACKING_ASSOCIATION_ORIGIN, 'https://registrystack.org');
  assert.equal(TRACKING_CONSENT_STORAGE_KEY, 'registrystack.shared-marketing-tracking.v2');
  assert.equal(TRACKING_IDENTITY_STORAGE_KEY, 'registrystack.shared-mautic-identity.v2');
  assert.equal(TRACKING_LOCAL_REFUSAL_STORAGE_KEY, 'registrystack.tracking-local-refusal.v2');
});

test('accepts only explicit synthetic Umami configuration and has no production default', () => {
  assert.equal(marketplaceAnalyticsConfig({}), null);
  assert.deepEqual(marketplaceAnalyticsConfig({
    websiteId: '00000000-0000-4000-8000-000000000001',
    scriptSrc: 'https://stats.example.test/script.js',
  }), {
    websiteId: '00000000-0000-4000-8000-000000000001',
    scriptSrc: 'https://stats.example.test/script.js',
    domain: 'marketplace.registrystack.org',
  });
  for (const config of [
    { websiteId: '00000000-0000-4000-8000-000000000001' },
    { scriptSrc: 'https://stats.example.test/script.js' },
    { websiteId: 'not-an-id', scriptSrc: 'https://stats.example.test/script.js' },
    { websiteId: '00000000-0000-4000-8000-000000000001', scriptSrc: 'http://stats.example.test/script.js' },
    { websiteId: '00000000-0000-4000-8000-000000000001', scriptSrc: 'https://person:secret@stats.example.test/script.js' },
    { websiteId: '00000000-0000-4000-8000-000000000001', scriptSrc: 'https://stats.example.test/script.js?token=private' },
  ]) assert.throws(() => marketplaceAnalyticsConfig(config), /Umami/i);
});

test('maps only public marketplace routes and strips search, fragments, and referrer paths', () => {
  for (const [input, expected] of [
    ['/', '/'],
    ['/contribute/?request_token=private', '/contribute/'],
    ['/privacy/#rights', '/privacy/'],
    ['/collections/', '/collections/'],
    ['/collections/professional-services/?search=private', '/collections/professional-services/'],
    ['/packs/professional-licensing/?email=private@example.org', '/packs/professional-licensing/'],
    ['/studio/professional-licensing/?search=private', '/studio/professional-licensing/'],
  ]) assert.equal(marketplaceCanonicalPath(input), expected);
  for (const input of [
    '/search/private/',
    '/packs/PERSON@example.org/',
    'https://evil.example/packs/professional-licensing/',
    '/packs/professional-licensing/extra/',
  ]) assert.equal(marketplaceCanonicalPath(input), null);

  assert.deepEqual(buildMarketplacePageview({
    path: '/packs/professional-licensing/?request_token=private',
    title: '  Professional licensing starter  ',
    referrer: 'https://partner.example/private?person=secret',
  }), {
    page_url: 'https://marketplace.registrystack.org/packs/professional-licensing/',
    page_title: 'Professional licensing starter',
    page_referrer: 'https://partner.example',
  });
});

test('allows only reviewed aggregate actions and public pack identifiers', () => {
  assert.deepEqual([...MARKETPLACE_ACTIONS], [
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
  const element = {
    dataset: {
      marketplaceAction: 'download_intent',
      packId: 'professional-licensing',
      requestToken: 'private',
      search: 'person@example.org',
    },
  };
  assert.deepEqual(marketplaceActionPayload(element, '/packs/professional-licensing/?secret=1'), {
    action: 'download_intent',
    source_path: '/packs/professional-licensing/',
    pack: 'professional-licensing',
  });
  assert.equal(marketplaceActionPayload({ dataset: { marketplaceAction: 'form_text' } }, '/'), null);
  assert.equal(marketplaceActionPayload({
    dataset: { marketplaceAction: 'download_intent', marketplacePack: 'person@example.org' },
  }, '/'), null);

  const calls = [];
  assert.equal(trackMarketplaceAction(element, {
    path: '/packs/professional-licensing/?secret=1',
    umami: { track: (...args) => calls.push(args) },
  }), true);
  assert.deepEqual(calls, [[
    'marketplace_action',
    { action: 'download_intent', source_path: '/packs/professional-licensing/', pack: 'professional-licensing' },
  ]]);
  assert.equal(trackMarketplaceAction(element, { path: '/', umami: undefined }), false);
});

test('sanitizes Umami event location without changing SDK metadata or event data', () => {
  const payload = {
    website: '00000000-0000-4000-8000-000000000001',
    hostname: 'marketplace.registrystack.org',
    screen: '1440x900',
    language: 'en-US',
    title: 'Professional licensing',
    url: 'https://marketplace.registrystack.org/packs/professional-licensing/?email=person@example.org#request-form',
    referrer: 'https://marketplace.registrystack.org/contribute/?message=private#form',
    name: 'marketplace_action',
    data: { action: 'download_intent', source_path: '/packs/professional-licensing/' },
  };
  const sanitized = marketplaceUmamiBeforeSend('event', payload);
  assert.deepEqual(sanitized, {
    ...payload,
    url: '/packs/professional-licensing/',
    referrer: 'https://marketplace.registrystack.org',
  });
  assert.notEqual(sanitized, payload);
  assert.match(payload.url, /person@example\.org/);

  assert.equal(marketplaceUmamiBeforeSend('event', {
    ...payload,
    url: '/privacy/?email=person@example.org',
    referrer: 'not a URL',
  }).referrer, '');
  assert.equal(marketplaceUmamiBeforeSend('event', {
    ...payload,
    url: '/contribute/#private',
    referrer: 'http://partner.example/private?email=person@example.org',
  }).referrer, 'http://partner.example');
});

test('rejects non-events and Umami payloads for invalid or private routes', () => {
  const payload = { url: '/', referrer: '' };
  for (const [type, candidate] of [
    ['identify', payload],
    ['pageview', payload],
    ['event', null],
    ['event', []],
    ['event', {}],
    ['event', { ...payload, url: '/search/person@example.org/' }],
    ['event', { ...payload, url: 'https://other.example/privacy/' }],
  ]) assert.equal(marketplaceUmamiBeforeSend(type, candidate), false);
});

test('DNT and GPC keep optional Mautic tracking off', () => {
  assert.equal(trackingDeniedByBrowser({ navigator: { doNotTrack: '1' } }), true);
  assert.equal(trackingDeniedByBrowser({ navigator: { doNotTrack: 'yes' } }), true);
  assert.equal(trackingDeniedByBrowser({ navigator: { globalPrivacyControl: true } }), true);
  assert.equal(trackingDeniedByBrowser({ navigator: { doNotTrack: '0', globalPrivacyControl: false } }), false);
  const now = Date.UTC(2026, 10, 4);
  const accepted = {
    choice: 'accepted',
    generation: '00000000-0000-4000-8000-000000000002',
    expiresAt: now + 1000,
    revision: now,
  };
  assert.equal(marketplaceTrackingAllowed({ state: accepted, navigator: {}, now }), true);
  assert.equal(marketplaceTrackingAllowed({ state: { ...accepted, choice: null }, navigator: {}, now }), false);
  assert.equal(marketplaceTrackingAllowed({ state: { ...accepted, choice: 'rejected' }, navigator: {}, now }), false);
  assert.equal(marketplaceTrackingAllowed({ state: { ...accepted, expiresAt: now }, navigator: {}, now }), false);
  assert.equal(marketplaceTrackingAllowed({ state: accepted, navigator: { doNotTrack: '1' }, now }), false);
  assert.equal(marketplaceTrackingAllowed({ state: accepted, navigator: { globalPrivacyControl: true }, now }), false);
});

test('component separates aggregate events from consented pageviews and never requests identity', async () => {
  const [component, privacy] = await Promise.all([
    readFile(new URL('src/components/MarketplaceTracking.astro', root), 'utf8'),
    readFile(new URL('src/pages/privacy.astro', root), 'utf8'),
  ]);
  await Promise.all([component, privacy].map(source => transform(source)));
  assert.match(component, /client\.pageview\(pageview\)/);
  assert.match(component, /script\.dataset\.excludeSearch = 'true'/);
  assert.match(component, /installMarketplaceActionTracking/);
  assert.match(component, /window\.location\.origin === 'https:\/\/marketplace\.registrystack\.org'/);
  assert.match(component, /Tracking is disabled in local preview/);
  assert.match(component, /PUBLIC_SHARED_TRACKING_ENABLED === 'true'/);
  assert.match(component, /script\.dataset\.excludeHash = 'true'/);
  assert.match(component, /window\.marketplaceUmamiBeforeSend = marketplaceUmamiBeforeSend/);
  assert.match(component, /script\.dataset\.beforeSend = 'marketplaceUmamiBeforeSend'/);
  assert.ok(
    component.indexOf('window.marketplaceUmamiBeforeSend = marketplaceUmamiBeforeSend')
      < component.indexOf('document.head.append(script)'),
    'The sanitizer must be installed before the Umami SDK executes.',
  );
  assert.match(component, /if \(!canonicalRuntime \|\| !sharedTrackingEnabled\)/);
  assert.match(component, /Optional visit tracking is not enabled on this site/);
  assert.match(component, /website and documentation/i);
  assert.match(component, /Marketplace tracking starts only after you accept here/);
  assert.match(privacy, /activity\s+already recorded from those sites/);
  assert.doesNotMatch(component, /\.associate\(|deviceId|mautic_device_id|mtc_id/);
  assert.doesNotMatch(component, /\.identify\(/);
  assert.match(privacy, /fresh acceptance/i);
  assert.match(privacy, /Do Not Track and Global Privacy Control/i);
  assert.match(
    privacy,
    /search terms, query parameters, form contents, email addresses, or request\s+tokens/i,
  );
});
