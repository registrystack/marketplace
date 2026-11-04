import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packs } from '../src/lib/catalogue.mjs';
import { renderCatalogue } from '../src/catalogue.js';
import { readFileSync } from 'node:fs';
test('PublicSchema badge follows verified starter provenance only', () => {
  assert.equal(packs.filter(pack => pack.publicschema).length, 84);
  for (const pack of packs) {
    const card = renderCatalogue([pack]);
    assert.equal(card.includes('data-publicschema'), Boolean(pack.publicschema), pack.id);
    const page = readFileSync(new URL('../dist/packs/' + pack.id + '/index.html', import.meta.url), 'utf8');
    assert.equal(page.includes('data-publicschema'), Boolean(pack.publicschema), pack.id);
  }
});
