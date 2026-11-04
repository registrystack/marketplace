import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyPreviewArtifact } from '../scripts/verify-preview-artifact.mjs';

const fixture = () => {
  const path = mkdtempSync(join(tmpdir(), 'marketplace-artifact-test-'));
  mkdirSync(join(path, 'packs', 'sample'), { recursive: true });
  const html = '<meta name="robots" content="noindex,nofollow"><h1>Public catalogue</h1>';
  writeFileSync(join(path, 'index.html'), html);
  writeFileSync(join(path, 'packs', 'sample', 'index.html'), html);
  writeFileSync(join(path, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return path;
};

const productionEnvironment = {
  PUBLIC_UMAMI_WEBSITE_ID: '00000000-0000-4000-8000-000000000001',
  PUBLIC_UMAMI_SCRIPT_SRC: 'https://stats.example.test/script.js',
  PUBLIC_STARTER_REQUEST_ENDPOINT: 'https://forms.example.test/form/submit?formId=12&privacy=kiosk',
  PUBLIC_SHARED_TRACKING_ENABLED: 'true',
};

const productionFixture = (sharedTrackingEnabled = 'true') => {
  const path = fixture();
  const html = [
    '<meta name="robots" content="noindex,nofollow">',
    `<div data-marketplace-analytics data-shared-tracking-enabled="${sharedTrackingEnabled}"`,
    ' data-umami-script-src="https://stats.example.test/script.js"',
    ' data-umami-website-id="00000000-0000-4000-8000-000000000001"',
    ' data-umami-domain="marketplace.registrystack.org"></div>',
    '<form data-pack-request-form',
    ' data-endpoint="https://forms.example.test/form/submit?formId=12&amp;privacy=kiosk"></form>',
  ].join('');
  writeFileSync(join(path, 'index.html'), html);
  writeFileSync(join(path, 'packs', 'sample', 'index.html'), html);
  return path;
};

test('review artifact rejects archive bytes, live configuration, and indexable pages', () => {
  assert.equal(verifyPreviewArtifact(fixture()).pages, 2);
  const archive = fixture();
  writeFileSync(join(archive, 'starter.zip'), 'private bytes');
  assert.throws(() => verifyPreviewArtifact(archive), /archive/i);
  for (const unsafe of [
    '<meta name="robots" content="index,follow">',
    '<meta name="robots" content="noindex,nofollow"><form data-endpoint="https://forms.example.test/form/submit">',
    '<meta name="robots" content="noindex,nofollow"><div data-umami-website-id="configured">',
    '<meta name="robots" content="noindex,nofollow"><div data-shared-tracking-enabled="true">',
  ]) {
    const path = fixture();
    writeFileSync(join(path, 'index.html'), unsafe);
    assert.throws(() => verifyPreviewArtifact(path));
  }
});

test('production artifact requires complete explicit configuration in the built pages', () => {
  assert.equal(verifyPreviewArtifact(productionFixture(), {
    production: true,
    environment: productionEnvironment,
  }).pages, 2);

  const trackingDisabled = {
    ...productionEnvironment,
    PUBLIC_SHARED_TRACKING_ENABLED: 'false',
  };
  assert.equal(verifyPreviewArtifact(productionFixture('false'), {
    production: true,
    environment: trackingDisabled,
  }).pages, 2);
  assert.throws(
    () => verifyPreviewArtifact(productionFixture('true'), {
      production: true,
      environment: trackingDisabled,
    }),
    /production|configuration|tracking/i,
  );
  for (const malformed of ['TRUE', '0', 'yes']) {
    assert.throws(
      () => verifyPreviewArtifact(productionFixture(), {
        production: true,
        environment: {
          ...productionEnvironment,
          PUBLIC_SHARED_TRACKING_ENABLED: malformed,
        },
      }),
      /explicitly true or false/i,
    );
  }

  for (const missing of Object.keys(productionEnvironment)) {
    const environment = { ...productionEnvironment, [missing]: '' };
    assert.throws(
      () => verifyPreviewArtifact(productionFixture(), { production: true, environment }),
      /production|configuration|tracking/i,
      missing,
    );
  }

  const mismatched = productionFixture();
  writeFileSync(
    join(mismatched, 'index.html'),
    '<meta name="robots" content="noindex,nofollow"><div data-marketplace-analytics data-shared-tracking-enabled="false"></div>',
  );
  assert.throws(
    () => verifyPreviewArtifact(mismatched, {
      production: true,
      environment: productionEnvironment,
    }),
    /production|configuration|tracking/i,
  );
});

test('production artifact retains archive, private-path, and no-index safeguards', () => {
  const options = { production: true, environment: productionEnvironment };

  const archive = productionFixture();
  writeFileSync(join(archive, 'starter.zip'), 'private bytes');
  assert.throws(() => verifyPreviewArtifact(archive, options), /archive/i);

  const privatePath = productionFixture();
  writeFileSync(join(privatePath, 'index.html'), '<meta name="robots" content="noindex,nofollow">content/downloads/private.zip');
  assert.throws(() => verifyPreviewArtifact(privatePath, options), /private|content\/downloads/i);

  const indexable = productionFixture();
  writeFileSync(join(indexable, 'index.html'), '<meta name="robots" content="index,follow">');
  assert.throws(() => verifyPreviewArtifact(indexable, options), /noindex|robots|production/i);
});
