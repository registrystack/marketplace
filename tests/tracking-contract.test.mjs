import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('vendored tracking client and protocol match the reviewed cross-site contract', () => {
  const contract = JSON.parse(readFileSync(new URL('../data/tracking-contract.json', import.meta.url), 'utf8'));
  assert.equal(contract.protocolVersion, 3);
  for (const name of ['tracking-protocol.mjs', 'shared-tracking-client.mjs']) {
    const content = readFileSync(new URL('../src/tracking/' + name, import.meta.url));
    assert.equal(createHash('sha256').update(content).digest('hex'), contract.files[name], name);
  }
});
