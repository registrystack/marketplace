import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packRequestEndpoint } from '../src/lib/pack-request.ts';
import { marketplaceAnalyticsConfig } from '../src/tracking/marketplace-tracking.mjs';

const attributeValues = (content, name) => [...content.matchAll(
  new RegExp(`\\b${name}="([^"]*)"`, 'g'),
)].map(match => match[1]
  .replaceAll(/&(?:amp|#38|#x26);/gi, '&')
  .replaceAll(/&(?:quot|#34|#x22);/gi, '"'));

function expectedProductionConfig(environment) {
  const sharedTrackingEnabled = environment.PUBLIC_SHARED_TRACKING_ENABLED;
  assert.ok(
    sharedTrackingEnabled === 'true' || sharedTrackingEnabled === 'false',
    'Production shared tracking must be explicitly true or false.',
  );
  let analytics;
  try {
    analytics = marketplaceAnalyticsConfig({
      websiteId: environment.PUBLIC_UMAMI_WEBSITE_ID,
      scriptSrc: environment.PUBLIC_UMAMI_SCRIPT_SRC,
    });
  } catch (error) {
    throw new Error('Production analytics configuration is invalid.', { cause: error });
  }
  assert.ok(analytics, 'Production analytics configuration is incomplete.');
  let requestEndpoint;
  try {
    requestEndpoint = packRequestEndpoint(environment.PUBLIC_STARTER_REQUEST_ENDPOINT);
  } catch (error) {
    throw new Error('Production request form configuration is invalid.', { cause: error });
  }
  assert.ok(requestEndpoint, 'Production request form configuration is incomplete.');
  return { analytics, requestEndpoint, sharedTrackingEnabled };
}

function assertAttribute(content, name, expected) {
  const values = attributeValues(content, name);
  assert.deepEqual(values, [expected], `Production ${name} configuration does not match the explicit build input.`);
}

export function verifyPreviewArtifact(
  directory,
  { production = false, environment = process.env } = {},
) {
  const root = resolve(directory);
  const expected = production ? expectedProductionConfig(environment) : null;
  let pages = 0;
  let analyticsPages = 0;
  let requestPages = 0;
  const inspect = path => {
    const entry = lstatSync(path);
    assert.ok(!entry.isSymbolicLink(), 'Published artifacts must not contain symlinks.');
    if (entry.isDirectory()) {
      for (const name of readdirSync(path)) inspect(join(path, name));
      return;
    }
    assert.ok(entry.isFile(), 'Published artifacts must contain regular files only.');
    assert.ok(!/\.(zip|tar|gz|tgz|7z)$/i.test(path), 'Published artifact contains an archive.');
    const content = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      content,
      /content\/downloads|"assetPath"|github\.com[/:]registrystack\/(?:registry-studio|breg-registry-starters)/i,
      'Published artifact contains a private asset path or repository pointer.',
    );
    if (path.endsWith('.html')) {
      pages++;
      assert.match(content, /<meta name="robots" content="noindex,nofollow"/);
      if (!production) {
        assert.doesNotMatch(content, /data-(?:endpoint|umami-script-src|umami-website-id)="[^\"]+"/, 'Review builds cannot include live form or analytics configuration.');
        assert.doesNotMatch(content, /data-shared-tracking-enabled="true"/, 'Review builds cannot activate shared visit tracking.');
        return;
      }

      const hasAnalytics = /\bdata-marketplace-analytics(?:\s|>)/.test(content);
      const hasRequestForm = /\bdata-pack-request-form(?:\s|>)/.test(content);
      if (hasAnalytics) {
        analyticsPages++;
        assertAttribute(content, 'data-shared-tracking-enabled', expected.sharedTrackingEnabled);
        assertAttribute(content, 'data-umami-script-src', expected.analytics.scriptSrc);
        assertAttribute(content, 'data-umami-website-id', expected.analytics.websiteId);
        assertAttribute(content, 'data-umami-domain', expected.analytics.domain);
      } else {
        assert.equal(attributeValues(content, 'data-shared-tracking-enabled').length, 0);
        assert.equal(attributeValues(content, 'data-umami-script-src').length, 0);
        assert.equal(attributeValues(content, 'data-umami-website-id').length, 0);
      }
      if (hasRequestForm) {
        requestPages++;
        assertAttribute(content, 'data-endpoint', expected.requestEndpoint);
      } else {
        assert.equal(attributeValues(content, 'data-endpoint').length, 0);
      }
    }
  };
  inspect(root);
  assert.ok(pages > 0, 'Published artifact has no pages.');
  if (production) {
    assert.ok(analyticsPages > 0, 'Production artifact has no analytics-configured pages.');
    assert.ok(requestPages > 0, 'Production artifact has no request-form-configured pages.');
  }
  assert.match(readFileSync(join(root, 'robots.txt'), 'utf8'), /User-agent: \*\s+Disallow: \/\s*$/);
  return { pages };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const production = args.includes('--production');
  const directory = args.find(argument => !argument.startsWith('--'))
    || new URL('../dist', import.meta.url).pathname;
  const result = verifyPreviewArtifact(directory, { production });
  const configuration = production ? 'complete explicit production configuration' : 'no live configuration';
  console.log(`Verified ${result.pages} pages: no archives, private paths, or indexable pages; ${configuration}.`);
}
