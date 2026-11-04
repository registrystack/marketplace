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

test('uses the fresh three-property consent scope without marketplace identity access', () => {
  assert.equal(TRACKING_PROTOCOL_VERSION, 3);
  assert.deepEqual(TRACKING_ALLOWED_ORIGINS, [
    'https://registrystack.org',
    'https://docs.registrystack.org',
    'https://marketplace.registrystack.org',
  ]);
  assert.equal(TRACKING_ASSOCIATION_ORIGIN, 'https://registrystack.org');
  assert.equal(TRACKING_CONSENT_STORAGE_KEY, 'registrystack.shared-marketing-tracking.v3');
  assert.equal(TRACKING_IDENTITY_STORAGE_KEY, 'registrystack.shared-mautic-identity.v3');
  assert.equal(TRACKING_LOCAL_REFUSAL_STORAGE_KEY, 'registrystack.tracking-local-refusal.v3');
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
  assert.match(component, /website, documentation, and marketplace/i);
  assert.doesNotMatch(component, /\.associate\(|deviceId|mautic_device_id|mtc_id/);
  assert.match(privacy, /fresh acceptance/i);
  assert.match(privacy, /Do Not Track and Global Privacy Control/i);
  assert.match(
    privacy,
    /search terms, query parameters, form contents, email addresses, or request\s+tokens/i,
  );
});
