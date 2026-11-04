import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('Astro generates all archive-matched starters and rich native detail', () => {
  const catalogue = JSON.parse(read('data/starter-catalogue.json'));
  assert.equal(catalogue.starters.length, 84);
  for (const starter of catalogue.starters) {
    const page = read('dist/packs/' + starter.id + '/index.html');
    for (const anchor of ['starter-title', 'records-title', 'actions-title', 'access-title', 'whats-inside']) assert.ok(page.includes('id="' + anchor + '"'), starter.id + ': ' + anchor);
    for (const type of starter.recordTypes) assert.ok(page.includes('id="record-' + type.id + '"'));
    assert.match(page, /noindex,nofollow/);
    assert.match(page, /Download pack/);
  }
});
test('solution collections retain all website memberships without moving its stories', () => {
  const data = JSON.parse(read('data/collections.json'));
  const collections = Array.isArray(data) ? data : data.collections;
  assert.equal(collections.length, 7);
  for (const collection of collections) {
    const page = read('dist/collections/' + (collection.id || collection.key) + '/index.html');
    for (const id of collection.starterIds) assert.ok(page.includes('/packs/' + id + '/'), id);
    assert.match(page, /https:\/\/registrystack.org\/solutions\//);
  }
});
test('a starter with direct record operations is not described as having no changes', () => {
  const page = read('dist/packs/public-transport-stops/index.html');
  assert.ok(page.includes('No named Actions are defined'));
  assert.ok(!page.includes('Can record:</strong> No changes'));
});
test('optional component availability is explicit even when all are absent', () => {
  const catalogue = JSON.parse(read('data/starter-catalogue.json'));
  for (const starter of catalogue.starters) {
    const page = read('dist/packs/' + starter.id + '/index.html');
    assert.ok(page.includes('data-optional-components'), starter.id);
    if (Object.values(starter.includes).some(included => !included)) assert.ok(page.includes('Not included'), starter.id);
  }
});
