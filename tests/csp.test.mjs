import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceCsp } from '../src/lib/content-security-policy.mjs';
import { readFileSync } from 'node:fs';
test('tracking and request policy enrolls exact configured origins only', () => {
  const baseline = marketplaceCsp();
  assert.ok(baseline.includes('frame-src https://registrystack.org'));
  assert.ok(!baseline.includes('example.test'));
  const policy = marketplaceCsp({ analyticsScript: 'https://stats.example.test/script.js', requestEndpoint: 'https://forms.example.test/form/submit?formId=1&privacy=kiosk' });
  assert.ok(policy.includes("connect-src 'self' https://stats.example.test https://forms.example.test"));
  assert.ok(!policy.includes('*'));
  assert.throws(() => marketplaceCsp({ analyticsScript: 'https://user:secret@example.test/script.js' }));
});
test('Astro emits executable scripts as self-hosted files under the site policy', () => {
  for (const path of ['index.html', 'contribute/index.html']) {
    const html = readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
    assert.ok(!/<script type="module">/.test(html), path);
  }
});
