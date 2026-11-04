import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Cloudflare configuration points the marketplace subdomain directly to GitHub Pages', () => {
  const record = JSON.parse(readFileSync(new URL('../docs/cloudflare-dns.json', import.meta.url), 'utf8'));
  assert.deepEqual(record, {
    type: 'CNAME',
    name: 'marketplace.registrystack.org',
    content: 'registrystack.github.io',
    ttl: 1,
    proxied: false,
  });
});
