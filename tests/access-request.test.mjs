import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { packs } from '../src/lib/catalogue.mjs';
const read = p => readFileSync(new URL('../dist/' + p, import.meta.url), 'utf8');
const files = (path) => readdirSync(path, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path + '/' + entry.name) : [path + '/' + entry.name]);
test('review output contains no archive bytes or public download links', () => {
  const output = files(new URL('../dist', import.meta.url).pathname);
  assert.deepEqual(output.filter(path => /\.(zip|tar|gz)$/i.test(path)), []);
  for (const path of output.filter(path => path.endsWith('.html'))) assert.doesNotMatch(readFileSync(path,'utf8'), /href="\/downloads\/|<a\b[^>]*\sdownload(?:[ =>])/);
});
test('every available pack opens a request popup with a main-site fallback', () => {
  for (const pack of packs.filter(pack => !pack.paid)) {
    const page = read('packs/' + pack.id + '/index.html');
    assert.match(page, /Download pack/);
    assert.match(page, /id="mp-request-dialog"/);
    assert.match(page, /data-marketplace-action="download_intent"/);
    assert.match(page, /Free on request/);
    const request = page.match(/href="(https:\/\/registrystack.org\/contact\/\?[^\"]+)"/);
    assert.ok(request, pack.id);
    const url = new URL(request[1].replaceAll('&amp;', '&'));
    assert.equal(url.searchParams.get('type'), 'starter');
    assert.equal(url.searchParams.get('context'), pack.title);
  }
});
