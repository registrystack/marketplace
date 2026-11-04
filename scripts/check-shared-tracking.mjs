import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < args.length; index += 2) options.set(args[index], args[index + 1]);
assert.equal(options.size, 2, 'Supply --website-root and --docs-root explicitly.');
for (const key of ['--website-root', '--docs-root']) assert.ok(options.get(key), 'Missing ' + key);
for (const name of ['tracking-protocol.mjs', 'shared-tracking-client.mjs']) {
  const local = readFileSync(new URL('../src/tracking/' + name, import.meta.url), 'utf8');
  const website = readFileSync(join(resolve(options.get('--website-root')), 'src/lib', name), 'utf8');
  const docs = readFileSync(join(resolve(options.get('--docs-root')), 'src/lib', name), 'utf8');
  assert.equal(local, website, name + ': website contract drift');
  assert.equal(local, docs, name + ': docs contract drift');
}
console.log('Shared protocol and client are byte-identical across marketplace, website, and docs.');
